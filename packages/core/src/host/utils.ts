import {
  FrontsError,
  createAbortedError,
  frontsErrorCodes,
  throwIfAborted,
  type FrontsErrorCode,
  type FrontsPhase,
} from '../errors.js';

export interface AbortableAcquisitionOptions<Value> {
  readonly acquire: () => PromiseLike<Value> | Value;
  readonly cleanup: (value: Value) => PromiseLike<void> | void;
  readonly onAbandoned?: (cleanup: Promise<void>) => void;
  readonly phase: FrontsPhase;
  readonly signal: AbortSignal;
}

export function linkAbortSignal(
  source: AbortSignal | undefined,
  controller: AbortController,
): () => void {
  if (source === undefined) {
    return () => undefined;
  }
  if (source.aborted) {
    controller.abort(source.reason);
    return () => undefined;
  }

  const abort = () => controller.abort(source.reason);
  source.addEventListener('abort', abort, { once: true });
  return () => source.removeEventListener('abort', abort);
}

export function asFrontsError(
  error: unknown,
  code: FrontsErrorCode,
  message: string,
  phase: FrontsPhase,
): FrontsError {
  if (error instanceof FrontsError) {
    if (error.phase === phase) {
      return error;
    }
    return new FrontsError(error.code, error.message, {
      cause: error,
      ...(error.details === undefined ? {} : { details: error.details }),
      phase,
    });
  }
  return new FrontsError(code, message, { cause: error, phase });
}

export async function raceWithAbort<Value>(
  value: PromiseLike<Value> | Value,
  signal: AbortSignal,
  phase: FrontsPhase,
): Promise<Value> {
  throwIfAborted(signal, phase);

  return new Promise<Value>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (!settled) {
        settled = true;
        signal.removeEventListener('abort', onAbort);
        callback();
      }
    };
    const onAbort = () => finish(() => reject(createAbortedError(phase, signal.reason)));
    signal.addEventListener('abort', onAbort, { once: true });

    Promise.resolve(value).then(
      (result) => finish(() => resolve(result)),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

export async function acquireWithAbort<Value>(
  options: AbortableAcquisitionOptions<Value>,
): Promise<Value> {
  throwIfAborted(options.signal, options.phase);
  const acquisition = Promise.resolve().then(() => {
    throwIfAborted(options.signal, options.phase);
    return options.acquire();
  });

  try {
    return await raceWithAbort(acquisition, options.signal, options.phase);
  } catch (error) {
    if (options.signal.aborted) {
      const cleanup = acquisition.then(
        async (value) => options.cleanup(value),
        () => undefined,
      );
      options.onAbandoned?.(cleanup);
      void cleanup.catch(() => undefined);
    }
    throw error;
  }
}

export async function waitUntilReady(
  ready: PromiseLike<void> | undefined,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<void> {
  throwIfAborted(signal, 'ready');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new FrontsError(
      frontsErrorCodes.readyTimeout,
      'readyTimeoutMs must be a finite, non-negative duration.',
      { phase: 'ready' },
    );
  }
  if (ready === undefined) {
    return;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout =
    timeoutMs === 0
      ? new Promise<never>(() => undefined)
      : new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(
              new FrontsError(
                frontsErrorCodes.readyTimeout,
                `Application did not become ready within ${timeoutMs}ms.`,
                { details: { timeoutMs }, phase: 'ready' },
              ),
            );
          }, timeoutMs);
        });

  try {
    await raceWithAbort(Promise.race([Promise.resolve(ready), timeout]), signal, 'ready');
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
