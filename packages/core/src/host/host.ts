import {
  assertAppHandle,
  getFrontsApp,
  type AppHandle,
  type ApplicationIdentity,
  type ServiceKey,
} from '../app/index.js';
import {
  ContainerRegistry,
  createContainerRegistry,
  type ContainerRequest,
} from '../container/index.js';
import {
  FrontsError,
  frontsErrorCodes,
  throwIfAborted,
  type FrontsErrorCode,
  type FrontsPhase,
} from '../errors.js';
import {
  assertResolvedApp,
  normalizeAppRef,
  type NormalizedAppRef,
  type ResolveContext,
  type ResolvedApp,
} from '../resolver/index.js';
import { createServiceScope, type ServiceScope } from '../services/index.js';
import { MountedApplicationImpl } from './instance.js';
import type {
  AppInstanceState,
  ApplicationInstanceSnapshot,
  FrontsHost,
  FrontsHostOptions,
  HostEvent,
  HostEventListener,
  HostResolveOptions,
  LoadedApp,
  MountAppOptions,
  MountedApplication,
  ReplaceAppOptions,
  ReplacementResult,
} from './types.js';
import { asFrontsError, linkAbortSignal, raceWithAbort, waitUntilReady } from './utils.js';

interface ApplicationRecord<Source> {
  identity: ApplicationIdentity;
  readonly ref: NormalizedAppRef;
  state: AppInstanceState;
  readonly createdAt: number;
  updatedAt: number;
  readonly controller: AbortController;
  containerType?: string;
  containerElement?: Element;
  resolved?: ResolvedApp<Source>;
  error?: FrontsError;
  deploymentSlot?: HTMLElement;
}

const allowedTransitions: Readonly<Record<AppInstanceState, readonly AppInstanceState[]>> = {
  resolving: ['loading', 'failed', 'aborted'],
  loading: ['preparing', 'failed', 'aborted'],
  preparing: ['mounting', 'failed', 'aborted'],
  mounting: ['ready', 'failed', 'aborted'],
  ready: ['updating', 'active', 'inactive', 'unmounting'],
  updating: ['ready', 'active', 'inactive', 'unmounting'],
  active: ['updating', 'inactive', 'unmounting'],
  inactive: ['updating', 'active', 'unmounting'],
  unmounting: ['destroyed', 'failed'],
  destroyed: [],
  failed: [],
  aborted: [],
};

function phaseForState(state: AppInstanceState): FrontsPhase {
  switch (state) {
    case 'resolving':
      return 'resolve';
    case 'loading':
      return 'load';
    case 'preparing':
      return 'container';
    case 'mounting':
      return 'mount';
    case 'updating':
      return 'update';
    case 'active':
      return 'activate';
    case 'inactive':
      return 'deactivate';
    case 'unmounting':
    case 'destroyed':
    case 'failed':
      return 'unmount';
    case 'ready':
    case 'aborted':
      return 'ready';
  }
}

function failureForPhase(phase: FrontsPhase): FrontsErrorCode {
  switch (phase) {
    case 'resolve':
      return frontsErrorCodes.resolutionFailed;
    case 'load':
      return frontsErrorCodes.loadFailed;
    case 'container':
      return frontsErrorCodes.containerFailed;
    case 'ready':
    case 'mount':
      return frontsErrorCodes.mountFailed;
    case 'update':
    case 'activate':
    case 'deactivate':
    case 'unmount':
      return frontsErrorCodes.lifecycleFailed;
  }
}

export class FrontsHostImpl<Source, Services extends object> implements FrontsHost<
  Source,
  Services
> {
  readonly #options: FrontsHostOptions<Source, Services>;
  readonly #containers: ContainerRegistry;
  readonly #services: Services;
  readonly #listeners = new Set<HostEventListener<Source>>();
  readonly #records = new Map<string, ApplicationRecord<Source>>();
  readonly #instances = new Map<string, MountedApplication<unknown, Source>>();
  readonly #pending = new Set<Promise<unknown>>();
  readonly #replacing = new Set<string>();
  readonly #now: () => number;
  readonly #readyTimeoutMs: number;
  #sequence = 0;
  #disposed = false;

  constructor(options: FrontsHostOptions<Source, Services>) {
    this.#options = options;
    this.#containers =
      options.containers instanceof ContainerRegistry
        ? options.containers
        : createContainerRegistry(options.containers);
    this.#services = options.services ?? ({} as Services);
    this.#now = options.now ?? Date.now;
    this.#readyTimeoutMs = options.readyTimeoutMs ?? 10_000;
    if (options.observer !== undefined) {
      this.#listeners.add(options.observer);
    }
  }

  async resolve(
    ref: Parameters<FrontsHost<Source, Services>['resolve']>[0],
    options: HostResolveOptions = {},
  ): Promise<ResolvedApp<Source>> {
    this.#assertAvailable();
    const normalized = normalizeAppRef(ref);
    const controller = new AbortController();
    const unlink = linkAbortSignal(options.signal, controller);

    try {
      const result = await raceWithAbort(
        this.#options.resolver.resolve(
          normalized,
          this.#resolveContext(options, controller.signal),
        ),
        controller.signal,
        'resolve',
      );
      assertResolvedApp<Source>(result, normalized);
      return { ...result, ref: normalized };
    } catch (error) {
      throw asFrontsError(
        error,
        frontsErrorCodes.resolutionFailed,
        `Failed to resolve application "${normalized.name}".`,
        'resolve',
      );
    } finally {
      unlink();
    }
  }

  async load<Props = unknown>(
    ref: Parameters<FrontsHost<Source, Services>['load']>[0],
    options: HostResolveOptions = {},
  ): Promise<LoadedApp<Props, Services, Source>> {
    const resolved = await this.resolve(ref, options);
    const controller = new AbortController();
    const unlink = linkAbortSignal(options.signal, controller);
    try {
      return await this.#loadResolved<Props>(resolved, controller.signal);
    } finally {
      unlink();
    }
  }

  async preload(
    ref: Parameters<FrontsHost<Source, Services>['preload']>[0],
    options: HostResolveOptions = {},
  ): Promise<ResolvedApp<Source>> {
    const resolved = await this.resolve(ref, options);
    const controller = new AbortController();
    const unlink = linkAbortSignal(options.signal, controller);
    try {
      if (this.#options.loader.preload === undefined) {
        await this.#loadResolved(resolved, controller.signal);
      } else {
        await raceWithAbort(
          this.#options.loader.preload(resolved, { signal: controller.signal }),
          controller.signal,
          'load',
        );
      }
      return resolved;
    } catch (error) {
      throw asFrontsError(
        error,
        frontsErrorCodes.loadFailed,
        `Failed to preload application "${resolved.ref.name}".`,
        'load',
      );
    } finally {
      unlink();
    }
  }

  mount<Props, Request extends ContainerRequest>(
    options: MountAppOptions<Props, Request>,
  ): Promise<MountedApplication<Props, Source>> {
    this.#assertAvailable();
    const task = this.#mount(options);
    this.#pending.add(task);
    void task.finally(() => this.#pending.delete(task)).catch(() => undefined);
    return task;
  }

  async replace<Props, Request extends ContainerRequest>(
    currentInstanceId: string,
    options: ReplaceAppOptions<Props, Request>,
  ): Promise<ReplacementResult<Props, Source>> {
    this.#assertAvailable();
    const current = this.#instances.get(currentInstanceId);
    if (current === undefined) {
      throw new FrontsError(
        frontsErrorCodes.instanceNotFound,
        `No mounted Fronts application has instance id "${currentInstanceId}".`,
        { phase: 'mount' },
      );
    }
    if (!['ready', 'active', 'inactive'].includes(current.state)) {
      throw new FrontsError(
        frontsErrorCodes.invalidState,
        `Cannot replace application "${currentInstanceId}" while it is ${current.state}.`,
        { details: { instanceId: currentInstanceId, state: current.state }, phase: 'mount' },
      );
    }
    if (this.#replacing.has(currentInstanceId)) {
      throw new FrontsError(
        frontsErrorCodes.invalidState,
        `Application "${currentInstanceId}" already has a replacement in progress.`,
        { details: { instanceId: currentInstanceId }, phase: 'mount' },
      );
    }

    this.#replacing.add(currentInstanceId);
    const slot = options.target.ownerDocument.createElement('div');
    slot.dataset.frontsDeployment = 'staging';
    slot.dataset.frontsReplaces = currentInstanceId;
    slot.hidden = true;
    slot.inert = true;
    slot.setAttribute('aria-hidden', 'true');
    options.target.append(slot);

    try {
      let replacement: MountedApplication<Props, Source> | undefined;
      try {
        replacement = await this.mount({ ...options, target: slot });
        if (options.signal !== undefined) {
          throwIfAborted(options.signal, 'ready');
        }
      } catch (error) {
        await replacement?.unmount().catch(() => undefined);
        slot.remove();
        throw error;
      }

      const replacementRecord = this.#records.get(replacement.identity.instanceId);
      if (
        replacementRecord?.containerElement === undefined ||
        !slot.contains(replacementRecord.containerElement)
      ) {
        await replacement.unmount().catch(() => undefined);
        slot.remove();
        throw new FrontsError(
          frontsErrorCodes.containerFailed,
          `Replacement container for "${replacement.identity.instanceId}" escaped its deployment slot.`,
          {
            details: { instanceId: replacement.identity.instanceId },
            phase: 'container',
          },
        );
      }
      replacementRecord.deploymentSlot = slot;
      slot.dataset.frontsDeployment = 'committed';
      slot.dataset.frontsInstance = replacement.identity.instanceId;
      slot.hidden = false;
      slot.inert = false;
      slot.removeAttribute('aria-hidden');
      slot.style.display = 'contents';

      let previousCleanupError: FrontsError | undefined;
      try {
        await current.unmount();
      } catch (error) {
        previousCleanupError = asFrontsError(
          error,
          frontsErrorCodes.lifecycleFailed,
          `Previous application "${currentInstanceId}" failed to clean up after replacement.`,
          'unmount',
        );
      }

      return {
        application: replacement,
        previous: current.identity,
        ...(previousCleanupError === undefined ? {} : { previousCleanupError }),
      };
    } finally {
      this.#replacing.delete(currentInstanceId);
    }
  }

  get(instanceId: string): MountedApplication<unknown, Source> | undefined {
    return this.#instances.get(instanceId);
  }

  inspect(): readonly ApplicationInstanceSnapshot<Source>[] {
    return [...this.#records.values()].map((record) => this.#snapshot(record));
  }

  subscribe(listener: HostEventListener<Source>): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async unmount(instanceId: string): Promise<void> {
    const instance = this.#instances.get(instanceId);
    if (instance === undefined) {
      throw new FrontsError(
        frontsErrorCodes.instanceNotFound,
        `No mounted Fronts application has instance id "${instanceId}".`,
        { phase: 'unmount' },
      );
    }
    await instance.unmount();
  }

  async dispose(): Promise<void> {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    for (const record of this.#records.values()) {
      if (!record.controller.signal.aborted) {
        record.controller.abort('Fronts host disposed');
      }
    }

    const operations = [
      ...this.#pending,
      ...[...this.#instances.values()].map((instance) => instance.unmount()),
    ];
    await Promise.allSettled(operations);
    this.#listeners.clear();
  }

  async #mount<Props, Request extends ContainerRequest>(
    options: MountAppOptions<Props, Request>,
  ): Promise<MountedApplication<Props, Source>> {
    const ref = normalizeAppRef(options.ref);
    const instanceId = options.instanceId ?? this.#createInstanceId(ref);
    if (this.#records.has(instanceId)) {
      throw new FrontsError(
        frontsErrorCodes.duplicateInstance,
        `Fronts application instance "${instanceId}" already exists.`,
        { phase: 'mount' },
      );
    }

    const controller = new AbortController();
    const unlinkSignal = linkAbortSignal(options.signal, controller);
    const containerRequest = options.container ?? ({ type: 'dom' } as Request);
    const loader = this.#options.containerLoaders?.[containerRequest.type] ?? this.#options.loader;
    const now = this.#now();
    const record: ApplicationRecord<Source> = {
      controller,
      createdAt: now,
      identity: { expose: ref.expose, instanceId, name: ref.name },
      ref,
      state: 'resolving',
      updatedAt: now,
      containerType: containerRequest.type,
    };
    this.#records.set(instanceId, record);
    this.#emitState(record, undefined, 'resolve');

    let phase: FrontsPhase = 'resolve';
    let container: Awaited<ReturnType<ContainerRegistry['prepare']>> | undefined;
    let appHandle: AppHandle<Props> | undefined;
    let scope:
      Awaited<ReturnType<typeof createServiceScope<Services, ServiceKey<Services>>>> | undefined;

    try {
      const resolveOptions = options.resolve ?? {};
      const resolved = await raceWithAbort(
        this.#options.resolver.resolve(
          ref,
          this.#resolveContext(resolveOptions, controller.signal),
        ),
        controller.signal,
        'resolve',
      );
      assertResolvedApp<Source>(resolved, ref);
      record.resolved = { ...resolved, ref };
      record.identity = {
        expose: ref.expose,
        instanceId,
        name: ref.name,
        ...(resolved.version === undefined ? {} : { version: resolved.version }),
      };

      phase = 'load';
      this.#transition(record, 'loading', phase);
      const loaded = await this.#loadResolved<Props>(record.resolved, controller.signal, loader);
      const app = loaded.app;

      scope = await createServiceScope({
        capabilities: app.capabilities ?? [],
        identity: record.identity,
        ...(this.#options.capabilityPolicy === undefined
          ? {}
          : { policy: this.#options.capabilityPolicy }),
        services: this.#services,
        signal: controller.signal,
      });

      phase = 'container';
      this.#transition(record, 'preparing', phase);
      container = await raceWithAbort(
        this.#containers.prepare({
          identity: record.identity,
          request: containerRequest,
          signal: controller.signal,
          target: options.target,
        }),
        controller.signal,
        'container',
      );
      record.containerElement = container.element;

      phase = 'mount';
      this.#transition(record, 'mounting', phase);
      appHandle = await raceWithAbort(
        app.mount({
          identity: record.identity,
          props: options.props,
          services: scope.services as Readonly<Services>,
          signal: controller.signal,
          target: container.target,
        }),
        controller.signal,
        'mount',
      );
      assertAppHandle<Props>(appHandle);

      phase = 'ready';
      await waitUntilReady(
        appHandle.ready,
        options.readyTimeoutMs ?? this.#readyTimeoutMs,
        controller.signal,
      );
      throwIfAborted(controller.signal, 'ready');
      this.#transition(record, 'ready', phase);

      const instance = new MountedApplicationImpl<Props, Services, Source>(
        {
          appHandle,
          container,
          controller,
          identity: record.identity,
          ref,
          resolved: record.resolved,
          scope: scope as ServiceScope<Partial<Services>>,
        },
        {
          onDisposed: () => {
            this.#instances.delete(instanceId);
            record.deploymentSlot?.remove();
          },
          reportError: (error) => this.#reportError(record, error, error.phase ?? phase),
          transition: (state) => this.#transition(record, state, phaseForState(state)),
          unlinkSignal,
        },
      );
      this.#instances.set(instanceId, instance as MountedApplication<unknown, Source>);
      return instance;
    } catch (error) {
      const failure = asFrontsError(
        error,
        failureForPhase(phase),
        `Application "${ref.name}" failed during ${phase}.`,
        phase,
      );
      if (!controller.signal.aborted) {
        controller.abort(failure);
      }
      if (appHandle !== undefined) {
        try {
          await appHandle.unmount();
        } catch {
          // The original mount failure remains authoritative.
        }
      }
      scope?.revoke();
      if (container !== undefined) {
        try {
          await container.dispose();
        } catch {
          // The original mount failure remains authoritative.
        }
      }
      unlinkSignal();

      record.error = failure;
      const terminal = failure.code === frontsErrorCodes.aborted ? 'aborted' : 'failed';
      this.#transition(record, terminal, phase);
      this.#reportError(record, failure, phase);
      throw failure;
    }
  }

  async #loadResolved<Props>(
    resolved: ResolvedApp<Source>,
    signal: AbortSignal,
    loader = this.#options.loader,
  ): Promise<LoadedApp<Props, Services, Source>> {
    try {
      const loaded = await raceWithAbort(loader.load(resolved, { signal }), signal, 'load');
      return { app: getFrontsApp<Props, Services>(loaded), resolved };
    } catch (error) {
      throw asFrontsError(
        error,
        frontsErrorCodes.loadFailed,
        `Failed to load application "${resolved.ref.name}".`,
        'load',
      );
    }
  }

  #resolveContext(options: HostResolveOptions, signal: AbortSignal): ResolveContext {
    return {
      signal,
      ...(options.environment === undefined ? {} : { environment: options.environment }),
      ...(options.tenant === undefined ? {} : { tenant: options.tenant }),
      ...(options.cohort === undefined ? {} : { cohort: options.cohort }),
      ...(options.metadata === undefined ? {} : { metadata: options.metadata }),
    };
  }

  #createInstanceId(ref: NormalizedAppRef): string {
    this.#sequence += 1;
    return this.#options.createInstanceId?.(ref) ?? `${ref.name}:${this.#sequence}`;
  }

  #transition(
    record: ApplicationRecord<Source>,
    state: AppInstanceState,
    phase: FrontsPhase,
  ): void {
    if (record.state === state) {
      return;
    }
    if (!allowedTransitions[record.state].includes(state)) {
      throw new FrontsError(
        frontsErrorCodes.invalidState,
        `Invalid Fronts state transition from ${record.state} to ${state}.`,
        { details: { from: record.state, to: state }, phase },
      );
    }

    const previousState = record.state;
    record.state = state;
    record.updatedAt = this.#now();
    this.#emitState(record, previousState, phase);
  }

  #snapshot(record: ApplicationRecord<Source>): ApplicationInstanceSnapshot<Source> {
    return {
      createdAt: record.createdAt,
      identity: record.identity,
      ref: record.ref,
      state: record.state,
      updatedAt: record.updatedAt,
      ...(record.containerType === undefined ? {} : { containerType: record.containerType }),
      ...(record.resolved === undefined ? {} : { resolved: record.resolved }),
      ...(record.error === undefined ? {} : { error: record.error }),
    };
  }

  #emitState(
    record: ApplicationRecord<Source>,
    previousState: AppInstanceState | undefined,
    phase: FrontsPhase,
  ): void {
    this.#emit({
      kind: 'state',
      phase,
      ...(previousState === undefined ? {} : { previousState }),
      snapshot: this.#snapshot(record),
      timestamp: this.#now(),
    });
  }

  #reportError(record: ApplicationRecord<Source>, error: FrontsError, phase: FrontsPhase): void {
    record.error = error;
    this.#emit({
      error,
      kind: 'error',
      phase,
      snapshot: this.#snapshot(record),
      timestamp: this.#now(),
    });
  }

  #emit(event: HostEvent<Source>): void {
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch {
        // Observability must never break application lifecycle operations.
      }
    }
  }

  #assertAvailable(): void {
    if (this.#disposed) {
      throw new FrontsError(frontsErrorCodes.hostDisposed, 'The Fronts host has been disposed.');
    }
  }
}

export function createFrontsHost<Source, Services extends object = object>(
  options: FrontsHostOptions<Source, Services>,
): FrontsHost<Source, Services> {
  return new FrontsHostImpl(options);
}
