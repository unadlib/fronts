import { FrontsError, frontsErrorCodes } from '../errors.js';
import type { AppInstanceState, MountedApplication, MountedApplicationResources } from './types.js';
import { asFrontsError } from './utils.js';

export interface MountedApplicationCallbacks {
  readonly transition: (state: AppInstanceState) => void;
  readonly reportError: (error: FrontsError) => void;
  readonly onDisposed: (clean: boolean) => void;
  readonly unlinkSignal: () => void;
}

export class MountedApplicationImpl<
  Props,
  Services extends object,
  Source,
> implements MountedApplication<Props, Source> {
  readonly identity;
  readonly ref;
  readonly resolved;
  readonly ready = Promise.resolve();

  readonly #resources: MountedApplicationResources<Props, Services, Source>;
  readonly #callbacks: MountedApplicationCallbacks;
  #state: AppInstanceState = 'ready';
  #queue: Promise<void> = Promise.resolve();
  #unmountPromise: Promise<void> | undefined;

  constructor(
    resources: MountedApplicationResources<Props, Services, Source>,
    callbacks: MountedApplicationCallbacks,
  ) {
    this.#resources = resources;
    this.#callbacks = callbacks;
    this.identity = resources.identity;
    this.ref = resources.ref;
    this.resolved = resources.resolved;

    resources.controller.signal.addEventListener(
      'abort',
      () => {
        void this.unmount().catch(() => undefined);
      },
      { once: true },
    );
  }

  get state(): AppInstanceState {
    return this.#state;
  }

  update(props: Props): Promise<void> {
    return this.#enqueue(async () => {
      this.#assertUsable('update');
      if (this.#resources.appHandle.update === undefined) {
        throw new FrontsError(
          frontsErrorCodes.lifecycleFailed,
          `Application "${this.identity.name}" does not implement update().`,
          { phase: 'update' },
        );
      }

      const stableState = this.#state;
      this.#setState('updating');
      try {
        await this.#resources.appHandle.update(props);
      } catch (error) {
        const failure = asFrontsError(
          error,
          frontsErrorCodes.lifecycleFailed,
          `Application "${this.identity.name}" failed to update.`,
          'update',
        );
        this.#callbacks.reportError(failure);
        throw failure;
      } finally {
        this.#setState(stableState);
      }
    });
  }

  activate(): Promise<void> {
    return this.#enqueue(async () => {
      this.#assertUsable('activate');
      if (this.#state === 'active') {
        return;
      }
      try {
        await this.#resources.appHandle.activate?.();
        this.#setState('active');
      } catch (error) {
        const failure = asFrontsError(
          error,
          frontsErrorCodes.lifecycleFailed,
          `Application "${this.identity.name}" failed to activate.`,
          'activate',
        );
        this.#callbacks.reportError(failure);
        throw failure;
      }
    });
  }

  deactivate(): Promise<void> {
    return this.#enqueue(async () => {
      this.#assertUsable('deactivate');
      if (this.#state === 'inactive') {
        return;
      }
      try {
        await this.#resources.appHandle.deactivate?.();
        this.#setState('inactive');
      } catch (error) {
        const failure = asFrontsError(
          error,
          frontsErrorCodes.lifecycleFailed,
          `Application "${this.identity.name}" failed to deactivate.`,
          'deactivate',
        );
        this.#callbacks.reportError(failure);
        throw failure;
      }
    });
  }

  abort(reason?: unknown): Promise<void> {
    if (!this.#resources.controller.signal.aborted) {
      this.#resources.controller.abort(reason);
    }
    return this.unmount();
  }

  unmount(): Promise<void> {
    if (this.#unmountPromise !== undefined) {
      return this.#unmountPromise;
    }

    this.#unmountPromise = this.#enqueue(async () => {
      if (this.#state === 'destroyed') {
        return;
      }
      this.#setState('unmounting');
      if (!this.#resources.controller.signal.aborted) {
        this.#resources.controller.abort('application unmounted');
      }

      const errors: unknown[] = [];
      try {
        await this.#resources.appHandle.unmount();
      } catch (error) {
        errors.push(error);
      }
      try {
        await this.#resources.scope.dispose();
      } catch (error) {
        errors.push(error);
      }
      try {
        await this.#resources.container.dispose();
      } catch (error) {
        errors.push(error);
      }

      this.#callbacks.unlinkSignal();

      if (errors.length > 0) {
        const failure = new FrontsError(
          frontsErrorCodes.lifecycleFailed,
          `Application "${this.identity.name}" failed to unmount cleanly.`,
          { cause: new AggregateError(errors), phase: 'unmount' },
        );
        this.#setState('failed');
        this.#callbacks.reportError(failure);
        this.#callbacks.onDisposed(false);
        throw failure;
      }

      this.#setState('destroyed');
      this.#callbacks.onDisposed(true);
    });

    return this.#unmountPromise;
  }

  #assertUsable(operation: 'activate' | 'deactivate' | 'update'): void {
    if (['unmounting', 'destroyed', 'failed', 'aborted'].includes(this.#state)) {
      throw new FrontsError(
        frontsErrorCodes.invalidState,
        `Cannot ${operation} application "${this.identity.name}" while it is ${this.#state}.`,
        { phase: operation },
      );
    }
  }

  #setState(state: AppInstanceState): void {
    this.#state = state;
    this.#callbacks.transition(state);
  }

  #enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.#queue.then(operation, operation);
    this.#queue = result.catch(() => undefined);
    return result;
  }
}
