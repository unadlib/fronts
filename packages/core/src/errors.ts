export const frontsErrorCodes = {
  aborted: 'FRONTS_ABORTED',
  capabilityDenied: 'FRONTS_CAPABILITY_DENIED',
  containerFailed: 'FRONTS_CONTAINER_FAILED',
  duplicateInstance: 'FRONTS_DUPLICATE_INSTANCE',
  instanceNotFound: 'FRONTS_INSTANCE_NOT_FOUND',
  invalidApp: 'FRONTS_INVALID_APP',
  lifecycleFailed: 'FRONTS_LIFECYCLE_FAILED',
  loadFailed: 'FRONTS_LOAD_FAILED',
  mountFailed: 'FRONTS_MOUNT_FAILED',
  readyTimeout: 'FRONTS_READY_TIMEOUT',
  resolutionFailed: 'FRONTS_RESOLUTION_FAILED',
  unsupportedProtocol: 'FRONTS_UNSUPPORTED_PROTOCOL',
} as const;

export type FrontsErrorCode = (typeof frontsErrorCodes)[keyof typeof frontsErrorCodes];

export type FrontsPhase =
  | 'resolve'
  | 'load'
  | 'container'
  | 'mount'
  | 'ready'
  | 'update'
  | 'activate'
  | 'deactivate'
  | 'unmount';

export interface FrontsErrorOptions {
  readonly cause?: unknown;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly phase?: FrontsPhase;
}

export class FrontsError extends Error {
  readonly code: FrontsErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;
  readonly phase: FrontsPhase | undefined;

  constructor(code: FrontsErrorCode, message: string, options: FrontsErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'FrontsError';
    this.code = code;
    this.details = options.details;
    this.phase = options.phase;
  }
}

export function isFrontsError(value: unknown): value is FrontsError {
  return value instanceof FrontsError;
}

export function createAbortedError(phase: FrontsPhase, cause?: unknown): FrontsError {
  return new FrontsError(frontsErrorCodes.aborted, `The Fronts ${phase} operation was aborted.`, {
    cause,
    phase,
  });
}

export function throwIfAborted(signal: AbortSignal, phase: FrontsPhase): void {
  if (signal.aborted) {
    throw createAbortedError(phase, signal.reason);
  }
}
