import { FrontsError, frontsErrorCodes } from '../errors.js';
import { FRONTS_APP_PROTOCOL, FRONTS_APP_PROTOCOL_VERSION } from './constants.js';
import type { AppHandle, FrontsApp, FrontsAppModule } from './types.js';

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasSupportedProtocol(value: Record<PropertyKey, unknown>): boolean {
  return (
    value.protocol === FRONTS_APP_PROTOCOL && value.protocolVersion === FRONTS_APP_PROTOCOL_VERSION
  );
}

export function isFrontsApp<Props = unknown, Services extends object = object>(
  value: unknown,
): value is FrontsApp<Props, Services> {
  if (!isRecord(value) || typeof value.mount !== 'function') {
    return false;
  }

  return hasSupportedProtocol(value);
}

export function assertFrontsApp<Props = unknown, Services extends object = object>(
  value: unknown,
): asserts value is FrontsApp<Props, Services> {
  if (!isRecord(value) || typeof value.mount !== 'function') {
    throw new FrontsError(
      frontsErrorCodes.invalidApp,
      'The loaded module does not expose a Fronts application.',
    );
  }

  if (!hasSupportedProtocol(value)) {
    throw new FrontsError(
      frontsErrorCodes.unsupportedProtocol,
      `Expected ${FRONTS_APP_PROTOCOL}@${FRONTS_APP_PROTOCOL_VERSION}.`,
      {
        details: {
          protocol: value.protocol,
          protocolVersion: value.protocolVersion,
        },
      },
    );
  }
}

export function getFrontsApp<Props = unknown, Services extends object = object>(
  loaded: unknown,
): FrontsApp<Props, Services> {
  const candidate = isRecord(loaded) && 'default' in loaded ? loaded.default : loaded;
  assertFrontsApp<Props, Services>(candidate);
  return candidate;
}

export function isFrontsAppModule<Props = unknown, Services extends object = object>(
  value: unknown,
): value is FrontsAppModule<Props, Services> {
  return isRecord(value) && isFrontsApp<Props, Services>(value.default);
}

export function assertAppHandle<Props = unknown>(
  value: unknown,
): asserts value is AppHandle<Props> {
  if (!isRecord(value) || typeof value.unmount !== 'function') {
    throw new FrontsError(
      frontsErrorCodes.invalidApp,
      'A Fronts application mount function must return an AppHandle with unmount().',
      { phase: 'mount' },
    );
  }

  if (
    value.ready !== undefined &&
    (!isRecord(value.ready) || typeof value.ready.then !== 'function')
  ) {
    throw new FrontsError(
      frontsErrorCodes.invalidApp,
      'AppHandle.ready must be a PromiseLike<void> when provided.',
      { phase: 'mount' },
    );
  }

  for (const method of ['activate', 'deactivate', 'update'] as const) {
    if (value[method] !== undefined && typeof value[method] !== 'function') {
      throw new FrontsError(
        frontsErrorCodes.invalidApp,
        `AppHandle.${method} must be a function when provided.`,
        { details: { method }, phase: 'mount' },
      );
    }
  }
}
