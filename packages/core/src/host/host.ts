import {
  assertAppHandle,
  getFrontsApp,
  type AppHandle,
  type ApplicationIdentity,
  type ServiceKey,
} from '../app/index.js';
import { FRONTS_NEGOTIABLE_CAPABILITIES_SYMBOL } from '../app/constants.js';
import {
  ContainerRegistry,
  createContainerRegistry,
  type ContainerRequest,
  type ContainerRequestResolver,
} from '../container/index.js';
import {
  FrontsError,
  frontsErrorCodes,
  stringifyUnknown,
  throwIfAborted,
  type FrontsErrorCode,
  type FrontsPhase,
} from '../errors.js';
import {
  assertResolvedApp,
  normalizeAppRef,
  type NormalizedAppRef,
  type ResolutionPolicyContext,
  type ResolveContext,
  type ResolvedApp,
} from '../resolver/index.js';
import type {
  ApplicationHostOperationContext,
  DetachedHostOperationContext,
  HostOperationIntent,
} from '../operation/index.js';
import {
  createServiceScope,
  type ServiceProviderResult,
  type ServiceScope,
} from '../services/index.js';
import { MountedApplicationImpl } from './instance.js';
import type {
  AppInstanceState,
  ApplicationInstanceSnapshot,
  FrontsHost,
  FrontsHostOptions,
  HostEvent,
  HostAuditReport,
  HostEventListener,
  HostResolveOptions,
  LoadedApp,
  MountAppOptions,
  MountedApplication,
  ReplaceAppOptions,
  ReplacementResult,
} from './types.js';
import {
  acquireWithAbort,
  asFrontsError,
  linkAbortSignal,
  raceWithAbort,
  waitUntilReady,
} from './utils.js';

interface ApplicationRecord<Source> {
  identity: ApplicationIdentity;
  readonly intent: ApplicationHostOperationContext['intent'];
  readonly operationId: string;
  readonly ref: NormalizedAppRef;
  state: AppInstanceState;
  readonly createdAt: number;
  updatedAt: number;
  readonly controller: AbortController;
  containerType?: string;
  containerElement?: Element;
  ownsContainerElement?: boolean;
  resolved?: ResolvedApp<Source>;
  error?: FrontsError;
  cleanupError?: FrontsError;
  cleanupCauses?: unknown[];
  deploymentSlot?: HTMLElement;
}

interface ServiceProvision<Services extends object> {
  readonly services: Services;
  dispose(): Promise<void>;
}

class RollbackCleanupFailure extends Error {
  readonly cleanupErrors: readonly unknown[];
  readonly primaryError: unknown;

  constructor(primaryError: unknown, cleanupErrors: readonly unknown[]) {
    super('A Fronts acquisition failed and its rollback was incomplete.', { cause: primaryError });
    this.name = 'RollbackCleanupFailure';
    this.cleanupErrors = cleanupErrors;
    this.primaryError = primaryError;
  }
}

let hostSequence = 0;

function createHostId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `fronts-host:${globalThis.crypto.randomUUID()}`;
  }
  hostSequence += 1;
  return `fronts-host:${hostSequence}`;
}

function normalizeRuntimeId(
  value: unknown,
  label: string,
  code: FrontsErrorCode,
  phase: FrontsPhase,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new FrontsError(code, `${label} must be a non-empty string.`, { phase });
  }
  return value.trim();
}

function validateReadyTimeout(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new FrontsError(
      frontsErrorCodes.readyTimeout,
      'readyTimeoutMs must be a finite, non-negative duration.',
      { phase: 'ready' },
    );
  }
  return value;
}

function createIdentityEnvelope(identity: ApplicationIdentity): ApplicationIdentity {
  return Object.freeze({ ...identity });
}

function createResolutionPolicyEnvelope(
  options: ResolutionPolicyContext,
): Readonly<ResolutionPolicyContext> {
  const { cohort, environment, metadata, tenant } = options;
  return Object.freeze({
    ...(environment === undefined ? {} : { environment }),
    ...(tenant === undefined ? {} : { tenant }),
    ...(cohort === undefined ? {} : { cohort }),
    ...(metadata === undefined ? {} : { metadata: Object.freeze({ ...metadata }) }),
  });
}

function createHostResolveOptionsEnvelope(options: HostResolveOptions): HostResolveOptions {
  const { operationId, signal, traceId } = options;
  return Object.freeze({
    ...createResolutionPolicyEnvelope(options),
    ...(operationId === undefined ? {} : { operationId }),
    ...(signal === undefined ? {} : { signal }),
    ...(traceId === undefined ? {} : { traceId }),
  });
}

function createResolvedEnvelope<Source>(
  resolved: ResolvedApp<Source>,
  ref: NormalizedAppRef,
): ResolvedApp<Source> {
  const { metadata, ...deployment } = resolved;
  return Object.freeze({
    ...deployment,
    ref,
    ...(metadata === undefined ? {} : { metadata: Object.freeze({ ...metadata }) }),
  });
}

function createContainerRequestEnvelope<Request extends ContainerRequest>(
  request: Request,
): Request {
  try {
    if (
      typeof request !== 'object' ||
      request === null ||
      Array.isArray(request) ||
      !Object.prototype.hasOwnProperty.call(request, 'type') ||
      typeof request.type !== 'string' ||
      request.type.trim() === '' ||
      request.type !== request.type.trim()
    ) {
      throw new FrontsError(
        frontsErrorCodes.containerFailed,
        'A container request must provide a non-empty type.',
        { phase: 'container' },
      );
    }

    const envelope: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(request)) {
      envelope[key] = value;
    }
    const attributes = envelope.attributes;
    if (typeof attributes === 'object' && attributes !== null && !Array.isArray(attributes)) {
      envelope.attributes = Object.freeze({ ...(attributes as Record<string, unknown>) });
    }
    const sandbox = envelope.sandbox;
    if (Array.isArray(sandbox)) {
      envelope.sandbox = Object.freeze([...sandbox] as unknown[]);
    }
    return Object.freeze(envelope) as Request;
  } catch (error) {
    if (error instanceof FrontsError) {
      throw error;
    }
    throw new FrontsError(
      frontsErrorCodes.containerFailed,
      'Failed to read the container request.',
      { cause: error, phase: 'container' },
    );
  }
}

function createReplacementSlot(target: Element | ShadowRoot, instanceId: string): HTMLElement {
  let slot: HTMLElement | undefined;
  try {
    slot = target.ownerDocument.createElement('div');
    slot.dataset.frontsDeployment = 'staging';
    slot.dataset.frontsReplaces = instanceId;
    slot.hidden = true;
    slot.inert = true;
    slot.setAttribute('aria-hidden', 'true');
    target.append(slot);
    return slot;
  } catch (error) {
    slot?.remove();
    throw asFrontsError(
      error,
      frontsErrorCodes.containerFailed,
      `Failed to create a replacement slot for "${instanceId}".`,
      'container',
    );
  }
}

function phaseForIntent(
  intent: HostOperationIntent,
): Extract<FrontsPhase, 'load' | 'mount' | 'resolve'> {
  switch (intent) {
    case 'resolve':
      return 'resolve';
    case 'load':
    case 'preload':
      return 'load';
    case 'mount':
    case 'replace':
      return 'mount';
  }
}

function normalizeDeclaredCapabilities<Services extends object>(
  value: unknown,
  identity: ApplicationIdentity,
): readonly ServiceKey<Services>[] {
  if (value === undefined) {
    return Object.freeze([]);
  }
  if (!Array.isArray(value)) {
    throw new FrontsError(
      frontsErrorCodes.capabilityDenied,
      `Application "${identity.name}" must declare capabilities as an array.`,
      { details: { reason: 'invalid' }, phase: 'mount' },
    );
  }

  const capabilities = new Set<ServiceKey<Services>>();
  for (const capability of value as unknown[]) {
    if (
      typeof capability !== 'string' ||
      capability.length === 0 ||
      ['__proto__', 'constructor', 'prototype'].includes(capability)
    ) {
      const description = stringifyUnknown(capability);
      throw new FrontsError(
        frontsErrorCodes.capabilityDenied,
        `Application "${identity.name}" requested invalid capability "${description}".`,
        {
          details: { capability: description, reason: 'invalid' },
          phase: 'mount',
        },
      );
    }
    capabilities.add(capability as ServiceKey<Services>);
  }
  return Object.freeze([...capabilities]);
}

function assertServiceProviderResult<Services extends object>(
  value: unknown,
): asserts value is ServiceProviderResult<Services> {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as Partial<ServiceProviderResult<Services>>).services !== 'object' ||
    (value as Partial<ServiceProviderResult<Services>>).services === null ||
    Array.isArray((value as Partial<ServiceProviderResult<Services>>).services) ||
    ((value as Partial<ServiceProviderResult<Services>>).dispose !== undefined &&
      typeof (value as Partial<ServiceProviderResult<Services>>).dispose !== 'function')
  ) {
    throw new FrontsError(
      frontsErrorCodes.mountFailed,
      'createServices() must return a services object and an optional dispose function.',
      { phase: 'mount' },
    );
  }
}

function createServiceDisposer(value: unknown): () => Promise<void> {
  let disposePromise: Promise<void> | undefined;
  return () => {
    disposePromise ??= (async () => {
      if (typeof value !== 'object' || value === null) {
        return;
      }
      const dispose = Reflect.get(value, 'dispose') as unknown;
      if (typeof dispose === 'function') {
        await Reflect.apply(dispose, value, []);
      }
    })();
    return disposePromise;
  };
}

function isTerminalState(state: AppInstanceState): boolean {
  return state === 'destroyed' || state === 'failed' || state === 'aborted';
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
  readonly id: string;
  readonly #options: FrontsHostOptions<Source, Services>;
  readonly #containers: ContainerRegistry<Source>;
  readonly #services: Services;
  readonly #listeners = new Set<HostEventListener<Source>>();
  readonly #records = new Map<string, ApplicationRecord<Source>>();
  readonly #instances = new Map<string, MountedApplication<unknown, Source>>();
  readonly #detachedControllers = new Set<AbortController>();
  readonly #pending = new Set<Promise<unknown>>();
  readonly #replacing = new Set<string>();
  readonly #replacementTasks = new Set<Promise<unknown>>();
  readonly #now: () => number;
  readonly #readyTimeoutMs: number;
  #instanceSequence = 0;
  #operationSequence = 0;
  #eventSequence = 0;
  #disposed = false;
  #disposePromise: Promise<void> | undefined;

  constructor(options: FrontsHostOptions<Source, Services>) {
    this.#options = options;
    this.#containers =
      options.containers instanceof ContainerRegistry
        ? options.containers
        : createContainerRegistry(options.containers);
    this.#services = options.services ?? ({} as Services);
    this.id = normalizeRuntimeId(
      options.hostId ?? createHostId(),
      'hostId',
      frontsErrorCodes.mountFailed,
      'mount',
    );
    this.#now = options.now ?? Date.now;
    this.#readyTimeoutMs = validateReadyTimeout(options.readyTimeoutMs ?? 10_000);
    if (options.observer !== undefined) {
      this.#listeners.add(options.observer);
    }
  }

  async resolve(
    ref: Parameters<FrontsHost<Source, Services>['resolve']>[0],
    options: HostResolveOptions = {},
  ): Promise<ResolvedApp<Source>> {
    this.#assertAvailable('resolve');
    const normalized = normalizeAppRef(ref);
    const requestOptions = createHostResolveOptionsEnvelope(options);
    return this.#scheduleDetachedOperation('resolve', normalized, requestOptions, (operation) =>
      this.#resolveResolved(normalized, requestOptions, operation),
    );
  }

  async load<Props = unknown>(
    ref: Parameters<FrontsHost<Source, Services>['load']>[0],
    options: HostResolveOptions = {},
  ): Promise<LoadedApp<Props, Services, Source>> {
    this.#assertAvailable('load');
    const normalized = normalizeAppRef(ref);
    const requestOptions = createHostResolveOptionsEnvelope(options);
    return this.#scheduleDetachedOperation(
      'load',
      normalized,
      requestOptions,
      async (operation) => {
        const resolved = await this.#resolveResolved(normalized, requestOptions, operation);
        return this.#loadResolved<Props>(resolved, operation);
      },
    );
  }

  async preload(
    ref: Parameters<FrontsHost<Source, Services>['preload']>[0],
    options: HostResolveOptions = {},
  ): Promise<ResolvedApp<Source>> {
    this.#assertAvailable('load');
    const normalized = normalizeAppRef(ref);
    const requestOptions = createHostResolveOptionsEnvelope(options);
    return this.#scheduleDetachedOperation(
      'preload',
      normalized,
      requestOptions,
      async (operation) => {
        try {
          const resolved = await this.#resolveResolved(normalized, requestOptions, operation);
          if (this.#options.loader.preload === undefined) {
            await this.#loadResolved(resolved, operation);
          } else {
            await raceWithAbort(
              this.#options.loader.preload(resolved, operation),
              operation.signal,
              'load',
            );
          }
          return resolved;
        } catch (error) {
          throw asFrontsError(
            error,
            frontsErrorCodes.loadFailed,
            `Failed to preload application "${normalized.name}".`,
            'load',
          );
        }
      },
    );
  }

  mount<Props, Request extends ContainerRequest>(
    options: MountAppOptions<Props, Request, Source>,
  ): Promise<MountedApplication<Props, Source>> {
    this.#assertAvailable('mount');
    return this.#scheduleMount(options, 'mount');
  }

  #scheduleMount<Props, Request extends ContainerRequest>(
    options: MountAppOptions<Props, Request, Source>,
    intent: ApplicationHostOperationContext['intent'],
  ): Promise<MountedApplication<Props, Source>> {
    const task = this.#mount(options, intent);
    return this.#trackPending(task);
  }

  #trackPending<Value>(task: Promise<Value>): Promise<Value> {
    this.#pending.add(task);
    void task.finally(() => this.#pending.delete(task)).catch(() => undefined);
    return task;
  }

  #scheduleDetachedOperation<Value>(
    intent: DetachedHostOperationContext['intent'],
    ref: NormalizedAppRef,
    options: HostResolveOptions,
    run: (operation: DetachedHostOperationContext) => Promise<Value>,
  ): Promise<Value> {
    const controller = new AbortController();
    const unlink = linkAbortSignal(options.signal, controller);
    this.#detachedControllers.add(controller);
    const task = Promise.resolve().then(async () => {
      try {
        const operation = this.#createDetachedOperation(intent, ref, controller.signal, options);
        return await run(operation);
      } finally {
        unlink();
        this.#detachedControllers.delete(controller);
      }
    });
    return this.#trackPending(task);
  }

  async #drainPending(): Promise<void> {
    while (this.#pending.size > 0) {
      await Promise.allSettled([...this.#pending]);
    }
  }

  async replace<Props, Request extends ContainerRequest>(
    currentInstanceId: string,
    options: ReplaceAppOptions<Props, Request, Source>,
  ): Promise<ReplacementResult<Props, Source>> {
    this.#assertAvailable('mount');
    return await this.#trackReplacement(this.#replace(currentInstanceId, options));
  }

  #trackReplacement<Value>(task: Promise<Value>): Promise<Value> {
    this.#replacementTasks.add(task);
    void task.finally(() => this.#replacementTasks.delete(task)).catch(() => undefined);
    return task;
  }

  async #replace<Props, Request extends ContainerRequest>(
    currentInstanceId: string,
    options: ReplaceAppOptions<Props, Request, Source>,
  ): Promise<ReplacementResult<Props, Source>> {
    const replacementSignal = options.signal;
    const target = options.target;
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
    try {
      const slot = createReplacementSlot(target, currentInstanceId);
      let replacement: MountedApplication<Props, Source> | undefined;
      try {
        replacement = await this.#scheduleMount({ ...options, target: slot }, 'replace');
        if (replacementSignal !== undefined) {
          throwIfAborted(replacementSignal, 'ready');
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
      try {
        replacementRecord.deploymentSlot = slot;
        slot.dataset.frontsDeployment = 'committed';
        slot.dataset.frontsInstance = replacement.identity.instanceId;
        slot.hidden = false;
        slot.inert = false;
        slot.removeAttribute('aria-hidden');
        slot.style.display = 'contents';
      } catch (error) {
        await replacement.unmount().catch(() => undefined);
        slot.remove();
        throw asFrontsError(
          error,
          frontsErrorCodes.containerFailed,
          `Failed to commit replacement container for "${replacement.identity.instanceId}".`,
          'container',
        );
      }

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
    this.#pruneCleanTerminalRecords();
    return [...this.#records.values()].map((record) => this.#snapshot(record));
  }

  audit(): HostAuditReport<Source> {
    this.#pruneCleanTerminalRecords();
    const activeInstances = [...this.#instances.keys()]
      .map((instanceId) => this.#records.get(instanceId))
      .filter((record): record is ApplicationRecord<Source> => record !== undefined)
      .map((record) => this.#snapshot(record));
    const retainedContainers = [...this.#records.values()]
      .filter(
        (record) =>
          record.ownsContainerElement === true &&
          record.containerElement !== undefined &&
          record.containerElement.parentNode !== null &&
          isTerminalState(record.state),
      )
      .map((record) => ({
        ...(record.containerType === undefined ? {} : { containerType: record.containerType }),
        identity: record.identity,
        state: record.state,
      }));
    const cleanupFailures = [...this.#records.values()]
      .filter((record) => record.cleanupError !== undefined)
      .map((record) => this.#snapshot(record));
    const replacementTransactions = [...this.#replacing];
    const pendingOperations = this.#pending.size;

    return {
      activeInstances,
      cleanupFailures,
      hostId: this.id,
      idle:
        activeInstances.length === 0 &&
        cleanupFailures.length === 0 &&
        pendingOperations === 0 &&
        replacementTransactions.length === 0 &&
        retainedContainers.length === 0,
      pendingOperations,
      replacementTransactions,
      retainedContainers,
    };
  }

  assertIdle(): void {
    const report = this.audit();
    if (report.idle) {
      return;
    }
    throw new FrontsError(
      frontsErrorCodes.runtimeLeak,
      `Fronts host "${this.id}" still has active or retained runtime resources.`,
      {
        details: {
          activeInstances: report.activeInstances.map(({ identity }) => identity.instanceId),
          cleanupFailures: report.cleanupFailures.map(({ identity }) => identity.instanceId),
          pendingOperations: report.pendingOperations,
          replacementTransactions: report.replacementTransactions,
          retainedContainers: report.retainedContainers.map(({ identity }) => identity.instanceId),
        },
      },
    );
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

  dispose(): Promise<void> {
    if (this.#disposePromise !== undefined) {
      return this.#disposePromise;
    }
    this.#disposed = true;
    this.#disposePromise = this.#disposeResources();
    return this.#disposePromise;
  }

  async #disposeResources(): Promise<void> {
    for (const record of this.#records.values()) {
      if (!record.controller.signal.aborted) {
        record.controller.abort('Fronts host disposed');
      }
    }
    for (const controller of this.#detachedControllers) {
      if (!controller.signal.aborted) {
        controller.abort('Fronts host disposed');
      }
    }

    const operations = [
      ...this.#pending,
      ...this.#replacementTasks,
      ...[...this.#instances.values()].map((instance) => instance.unmount()),
    ];
    try {
      await Promise.allSettled(operations);
      await this.#drainPending();
      this.assertIdle();
    } finally {
      this.#listeners.clear();
    }
  }

  async #mount<Props, Request extends ContainerRequest>(
    options: MountAppOptions<Props, Request, Source>,
    intent: ApplicationHostOperationContext['intent'],
  ): Promise<MountedApplication<Props, Source>> {
    const {
      container: requestedContainer,
      instanceId: requestedInstanceId,
      operationId: requestedOperationId,
      props,
      readyTimeoutMs: requestedReadyTimeoutMs,
      ref: requestedRef,
      resolve: requestedResolution,
      signal,
      target,
      traceId: requestedTraceId,
    } = options;
    const ref = normalizeAppRef(requestedRef);
    const readyTimeoutMs = validateReadyTimeout(requestedReadyTimeoutMs ?? this.#readyTimeoutMs);
    const resolution = createResolutionPolicyEnvelope(requestedResolution ?? {});
    const instanceId = normalizeRuntimeId(
      requestedInstanceId ?? this.#createInstanceId(ref),
      'instanceId',
      frontsErrorCodes.mountFailed,
      'mount',
    );
    if (this.#records.has(instanceId)) {
      throw new FrontsError(
        frontsErrorCodes.duplicateInstance,
        `Fronts application instance "${instanceId}" already exists.`,
        { phase: 'mount' },
      );
    }

    const controller = new AbortController();
    let containerResolver: ContainerRequestResolver<Source, Request> | undefined;
    let containerRequest: Request | undefined;
    if (typeof requestedContainer === 'function') {
      containerResolver = requestedContainer;
    } else {
      containerRequest = createContainerRequestEnvelope(
        requestedContainer === undefined
          ? ({ type: 'dom' } as Request)
          : (requestedContainer as Request),
      );
    }
    const now = this.#readNow(Date.now());
    const traceId = normalizeRuntimeId(
      requestedTraceId ??
        this.#options.createTraceId?.(ref, instanceId) ??
        `${this.id}:${instanceId}`,
      'traceId',
      frontsErrorCodes.mountFailed,
      'mount',
    );
    const initialIdentity = createIdentityEnvelope({
      expose: ref.expose,
      instanceId,
      name: ref.name,
      traceId,
    });
    let operation = this.#createApplicationOperation(
      intent,
      ref,
      initialIdentity,
      controller.signal,
      requestedOperationId,
    );
    const unlinkSignal = linkAbortSignal(signal, controller);
    const record: ApplicationRecord<Source> = {
      controller,
      createdAt: now,
      identity: initialIdentity,
      intent,
      operationId: operation.operationId,
      ref,
      state: 'resolving',
      updatedAt: now,
      ...(containerRequest === undefined ? {} : { containerType: containerRequest.type }),
    };
    this.#records.set(instanceId, record);
    this.#emitState(record, undefined, 'resolve', now, 0);

    let phase: FrontsPhase = 'resolve';
    let container: Awaited<ReturnType<ContainerRegistry<Source>['prepare']>> | undefined;
    let appHandle: AppHandle<Props> | undefined;
    let provision: ServiceProvision<Services> | undefined;
    const cleanupErrors: unknown[] = [];
    const abandonedCleanups: Promise<void>[] = [];
    const trackAbandonedCleanup = (cleanup: Promise<void>): void => {
      abandonedCleanups.push(cleanup);
    };
    let scope:
      Awaited<ReturnType<typeof createServiceScope<Services, ServiceKey<Services>>>> | undefined;

    try {
      const resolved = await raceWithAbort(
        this.#options.resolver.resolve(ref, this.#resolveContext(resolution, operation)),
        controller.signal,
        'resolve',
      );
      assertResolvedApp<Source>(resolved, ref);
      const resolvedDeployment = createResolvedEnvelope(resolved, ref);
      record.resolved = resolvedDeployment;
      record.identity = createIdentityEnvelope({
        expose: ref.expose,
        instanceId,
        name: ref.name,
        traceId,
        ...(resolvedDeployment.version === undefined
          ? {}
          : { version: resolvedDeployment.version }),
      });
      operation = Object.freeze({ ...operation, identity: record.identity });

      if (containerRequest === undefined) {
        phase = 'container';
        throwIfAborted(controller.signal, phase);
        const planned = await raceWithAbort(
          containerResolver?.(
            Object.freeze({
              identity: record.identity,
              operation,
              resolution,
              resolved: resolvedDeployment,
              signal: controller.signal,
              target,
            }),
          ),
          controller.signal,
          phase,
        );
        containerRequest = createContainerRequestEnvelope(planned as Request);
        throwIfAborted(controller.signal, phase);
      }
      const selectedContainerRequest = containerRequest;
      record.containerType = selectedContainerRequest.type;
      phase = 'load';
      const containerLoaders = this.#options.containerLoaders;
      const loader =
        containerLoaders !== undefined &&
        Object.prototype.hasOwnProperty.call(containerLoaders, selectedContainerRequest.type)
          ? (containerLoaders[selectedContainerRequest.type] ?? this.#options.loader)
          : this.#options.loader;

      this.#transition(record, 'loading', phase);
      const loaded = await this.#loadResolved<Props>(resolvedDeployment, operation, loader);
      const app = loaded.app;

      phase = 'mount';
      const capabilities = normalizeDeclaredCapabilities<Services>(
        app.capabilities,
        record.identity,
      );
      provision = await this.#provideServices(
        capabilities,
        resolution,
        resolvedDeployment,
        operation,
      );
      const negotiableCapabilities =
        Reflect.get(app, FRONTS_NEGOTIABLE_CAPABILITIES_SYMBOL) === true;
      const scopedCapabilities = negotiableCapabilities
        ? await this.#selectNegotiableCapabilities(
            capabilities,
            record.identity,
            provision.services,
            controller.signal,
          )
        : capabilities;
      scope = await createServiceScope({
        capabilities: scopedCapabilities,
        dispose: provision.dispose,
        identity: record.identity,
        ...(this.#options.capabilityPolicy === undefined || negotiableCapabilities
          ? {}
          : { policy: this.#options.capabilityPolicy }),
        services: provision.services,
        signal: controller.signal,
      });

      phase = 'container';
      this.#transition(record, 'preparing', phase);
      container = await acquireWithAbort({
        acquire: () =>
          this.#containers.prepare(
            Object.freeze({
              identity: record.identity,
              operation,
              request: selectedContainerRequest,
              resolved: resolvedDeployment,
              signal: controller.signal,
              target,
            }),
          ),
        cleanup: async (prepared) => {
          record.containerElement = prepared.element;
          record.ownsContainerElement = prepared.ownsElement ?? false;
          await prepared.dispose();
        },
        onAbandoned: trackAbandonedCleanup,
        phase: 'container',
        signal: controller.signal,
      });
      record.containerElement = container.element;
      record.ownsContainerElement = container.ownsElement ?? false;

      phase = 'mount';
      this.#transition(record, 'mounting', phase);
      const mountContainer = container;
      const mountScope = scope;
      appHandle = await acquireWithAbort({
        acquire: () =>
          app.mount(
            Object.freeze({
              identity: record.identity,
              props,
              services: mountScope.services as Readonly<Services>,
              signal: controller.signal,
              target: mountContainer.target,
            }),
          ),
        cleanup: async (handle) => handle.unmount(),
        onAbandoned: trackAbandonedCleanup,
        phase: 'mount',
        signal: controller.signal,
      });
      assertAppHandle<Props>(appHandle);

      phase = 'ready';
      await waitUntilReady(appHandle.ready, readyTimeoutMs, controller.signal);
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
          onDisposed: (clean) => {
            this.#instances.delete(instanceId);
            record.deploymentSlot?.remove();
            if (clean) {
              this.#releaseRecord(record);
            }
          },
          reportError: (error) => this.#reportError(record, error, error.phase ?? phase),
          transition: (state) => this.#transition(record, state, phaseForState(state)),
          unlinkSignal,
        },
      );
      this.#instances.set(instanceId, instance as MountedApplication<unknown, Source>);
      return instance;
    } catch (error) {
      const primaryError = error instanceof RollbackCleanupFailure ? error.primaryError : error;
      if (error instanceof RollbackCleanupFailure) {
        cleanupErrors.push(...error.cleanupErrors);
      }
      const failure = asFrontsError(
        primaryError,
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
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError);
          // The original mount failure remains authoritative.
        }
      }
      try {
        if (scope === undefined) {
          await provision?.dispose();
        } else {
          await scope.dispose();
        }
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
        // The original mount failure remains authoritative.
      }
      if (container !== undefined) {
        try {
          await container.dispose();
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError);
          // The original mount failure remains authoritative.
        }
      }
      unlinkSignal();

      record.error = failure;
      const terminal = failure.code === frontsErrorCodes.aborted ? 'aborted' : 'failed';
      this.#transition(record, terminal, phase);
      this.#reportError(record, failure, phase);
      if (cleanupErrors.length > 0) {
        this.#recordCleanupFailure(record, cleanupErrors);
      }
      if (abandonedCleanups.length === 0) {
        if (cleanupErrors.length === 0) {
          this.#releaseRecord(record);
        }
      } else {
        const release = Promise.allSettled(abandonedCleanups).then((results) => {
          const lateCleanupErrors = results.flatMap((result) =>
            result.status === 'rejected' ? [result.reason] : [],
          );
          if (lateCleanupErrors.length > 0) {
            this.#recordCleanupFailure(record, lateCleanupErrors);
          } else if (cleanupErrors.length === 0) {
            this.#releaseRecord(record);
          }
        });
        this.#trackPending(release);
      }
      throw failure;
    }
  }

  #releaseRecord(record: ApplicationRecord<Source>): void {
    if (record.cleanupError !== undefined) {
      return;
    }
    if (
      record.ownsContainerElement === true &&
      record.containerElement !== undefined &&
      record.containerElement.parentNode !== null
    ) {
      return;
    }
    if (this.#records.get(record.identity.instanceId) === record) {
      this.#records.delete(record.identity.instanceId);
    }
  }

  #pruneCleanTerminalRecords(): void {
    for (const record of this.#records.values()) {
      if (isTerminalState(record.state) && !this.#instances.has(record.identity.instanceId)) {
        this.#releaseRecord(record);
      }
    }
  }

  #recordCleanupFailure(record: ApplicationRecord<Source>, errors: readonly unknown[]): void {
    record.cleanupCauses ??= [];
    record.cleanupCauses.push(...errors);
    const failure = new FrontsError(
      frontsErrorCodes.lifecycleFailed,
      `Application "${record.identity.name}" failed to clean up completely.`,
      {
        cause: new AggregateError(record.cleanupCauses),
        details: { failureCount: record.cleanupCauses.length },
        phase: 'unmount',
      },
    );
    this.#reportError(record, failure, 'unmount');
  }

  async #selectNegotiableCapabilities(
    capabilities: readonly ServiceKey<Services>[],
    identity: ApplicationIdentity,
    services: Services,
    signal: AbortSignal,
  ): Promise<readonly ServiceKey<Services>[]> {
    const selected: ServiceKey<Services>[] = [];
    for (const capability of capabilities) {
      throwIfAborted(signal, 'mount');
      if (!Object.prototype.hasOwnProperty.call(services, capability)) {
        continue;
      }
      const service = services[capability];
      const allowed =
        this.#options.capabilityPolicy === undefined ||
        (await this.#options.capabilityPolicy({ capability, identity, service }));
      throwIfAborted(signal, 'mount');
      if (allowed) {
        selected.push(capability);
      }
    }
    return Object.freeze(selected);
  }

  async #provideServices(
    capabilities: readonly ServiceKey<Services>[],
    resolution: Readonly<ResolutionPolicyContext>,
    resolved: ResolvedApp<Source>,
    operation: ApplicationHostOperationContext,
  ): Promise<ServiceProvision<Services>> {
    const provider = this.#options.createServices;
    if (provider === undefined) {
      return { dispose: async () => undefined, services: this.#services };
    }

    throwIfAborted(operation.signal, 'mount');
    const result: unknown = await provider({
      capabilities,
      hostId: this.id,
      identity: operation.identity,
      operation,
      resolution,
      resolved,
      signal: operation.signal,
    });
    const dispose = createServiceDisposer(result);

    try {
      assertServiceProviderResult<Services>(result);
      throwIfAborted(operation.signal, 'mount');
      const services = Object.assign(
        Object.create(null) as Services,
        this.#services,
        result.services,
      );
      return { dispose, services: Object.freeze(services) };
    } catch (error) {
      try {
        await dispose();
      } catch (cleanupError) {
        throw new RollbackCleanupFailure(error, [cleanupError]);
      }
      throw error;
    }
  }

  async #loadResolved<Props>(
    resolved: ResolvedApp<Source>,
    operation: ApplicationHostOperationContext | DetachedHostOperationContext,
    loader = this.#options.loader,
  ): Promise<LoadedApp<Props, Services, Source>> {
    try {
      const loaded = await raceWithAbort(
        loader.load(resolved, operation),
        operation.signal,
        'load',
      );
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

  async #resolveResolved(
    ref: NormalizedAppRef,
    options: ResolutionPolicyContext,
    operation: ApplicationHostOperationContext | DetachedHostOperationContext,
  ): Promise<ResolvedApp<Source>> {
    try {
      const result = await raceWithAbort(
        this.#options.resolver.resolve(ref, this.#resolveContext(options, operation)),
        operation.signal,
        'resolve',
      );
      assertResolvedApp<Source>(result, ref);
      return createResolvedEnvelope(result, ref);
    } catch (error) {
      throw asFrontsError(
        error,
        frontsErrorCodes.resolutionFailed,
        `Failed to resolve application "${ref.name}".`,
        'resolve',
      );
    }
  }

  #resolveContext(
    options: ResolutionPolicyContext,
    operation: ApplicationHostOperationContext | DetachedHostOperationContext,
  ): ResolveContext {
    return Object.freeze({
      operation,
      signal: operation.signal,
      ...(options.environment === undefined ? {} : { environment: options.environment }),
      ...(options.tenant === undefined ? {} : { tenant: options.tenant }),
      ...(options.cohort === undefined ? {} : { cohort: options.cohort }),
      ...(options.metadata === undefined ? {} : { metadata: options.metadata }),
    });
  }

  #createDetachedOperation(
    intent: DetachedHostOperationContext['intent'],
    ref: NormalizedAppRef,
    signal: AbortSignal,
    options: Pick<HostResolveOptions, 'operationId' | 'traceId'>,
  ): DetachedHostOperationContext {
    const phase = phaseForIntent(intent);
    const code = failureForPhase(phase);
    return Object.freeze({
      hostId: this.id,
      intent,
      operationId: this.#createOperationId(intent, ref, options.operationId),
      signal,
      ...(options.traceId === undefined
        ? {}
        : { traceId: normalizeRuntimeId(options.traceId, 'traceId', code, phase) }),
    });
  }

  #createApplicationOperation(
    intent: ApplicationHostOperationContext['intent'],
    ref: NormalizedAppRef,
    identity: ApplicationIdentity,
    signal: AbortSignal,
    operationId?: string,
  ): ApplicationHostOperationContext {
    return Object.freeze({
      hostId: this.id,
      identity,
      intent,
      operationId: this.#createOperationId(intent, ref, operationId),
      signal,
      traceId: normalizeRuntimeId(
        identity.traceId,
        'traceId',
        frontsErrorCodes.mountFailed,
        'mount',
      ),
    });
  }

  #createOperationId(
    intent: HostOperationIntent,
    ref: NormalizedAppRef,
    operationId?: string,
  ): string {
    this.#operationSequence += 1;
    const phase = phaseForIntent(intent);
    return normalizeRuntimeId(
      operationId ??
        this.#options.createOperationId?.(intent, ref) ??
        `${this.id}:${intent}:${this.#operationSequence}`,
      'operationId',
      failureForPhase(phase),
      phase,
    );
  }

  #createInstanceId(ref: NormalizedAppRef): string {
    this.#instanceSequence += 1;
    return this.#options.createInstanceId?.(ref) ?? `${ref.name}:${this.#instanceSequence}`;
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
    const timestamp = Math.max(record.updatedAt, this.#readNow(record.updatedAt));
    const durationMs = timestamp - record.updatedAt;
    record.state = state;
    record.updatedAt = timestamp;
    this.#emitState(record, previousState, phase, timestamp, durationMs);
  }

  #snapshot(record: ApplicationRecord<Source>): ApplicationInstanceSnapshot<Source> {
    return {
      createdAt: record.createdAt,
      identity: record.identity,
      intent: record.intent,
      operationId: record.operationId,
      ref: record.ref,
      state: record.state,
      updatedAt: record.updatedAt,
      ...(record.containerType === undefined ? {} : { containerType: record.containerType }),
      ...(record.resolved === undefined ? {} : { resolved: record.resolved }),
      ...(record.error === undefined ? {} : { error: record.error }),
      ...(record.cleanupError === undefined ? {} : { cleanupError: record.cleanupError }),
    };
  }

  #emitState(
    record: ApplicationRecord<Source>,
    previousState: AppInstanceState | undefined,
    phase: FrontsPhase,
    timestamp: number,
    durationMs: number,
  ): void {
    this.#emit({
      durationMs,
      hostId: this.id,
      kind: 'state',
      phase,
      sequence: ++this.#eventSequence,
      ...(previousState === undefined ? {} : { previousState }),
      snapshot: this.#snapshot(record),
      timestamp,
    });
  }

  #reportError(record: ApplicationRecord<Source>, error: FrontsError, phase: FrontsPhase): void {
    if (phase === 'unmount') {
      record.cleanupError = error;
      record.error ??= error;
    } else {
      record.error = error;
    }
    this.#emit({
      error,
      hostId: this.id,
      kind: 'error',
      phase,
      sequence: ++this.#eventSequence,
      snapshot: this.#snapshot(record),
      timestamp: Math.max(record.updatedAt, this.#readNow(record.updatedAt)),
    });
  }

  #readNow(fallback: number): number {
    try {
      const value = this.#now();
      return Number.isFinite(value) ? value : fallback;
    } catch {
      return fallback;
    }
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

  #assertAvailable(phase: FrontsPhase): void {
    if (this.#disposed) {
      throw new FrontsError(frontsErrorCodes.hostDisposed, 'The Fronts host has been disposed.', {
        phase,
      });
    }
  }
}

export function createFrontsHost<Source, Services extends object = object>(
  options: FrontsHostOptions<Source, Services>,
): FrontsHost<Source, Services> {
  return new FrontsHostImpl(options);
}
