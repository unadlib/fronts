import { FrontsError, frontsErrorCodes, type NormalizedAppRef } from '@fronts/core';
import type { Remote } from '@module-federation/runtime/types';

import type { ModuleFederationSource } from './types.js';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

export function assertModuleFederationSource(
  source: unknown,
): asserts source is ModuleFederationSource {
  if (!isRecord(source) || !isRecord(source.remote)) {
    throw new FrontsError(
      frontsErrorCodes.loadFailed,
      'A Module Federation source must contain a remote definition.',
      { phase: 'load' },
    );
  }

  const remote = source.remote;
  if (typeof remote.name !== 'string' || remote.name.trim() === '') {
    throw new FrontsError(
      frontsErrorCodes.loadFailed,
      'A Module Federation remote must have a non-empty name.',
      { phase: 'load' },
    );
  }
  if (
    (typeof remote.entry !== 'string' || remote.entry.trim() === '') &&
    (typeof remote.version !== 'string' || remote.version.trim() === '')
  ) {
    throw new FrontsError(
      frontsErrorCodes.loadFailed,
      `Module Federation remote "${remote.name}" must provide an entry or version.`,
      { phase: 'load' },
    );
  }
}

export function createModuleFederationSource(
  remote: Remote,
  options: Omit<ModuleFederationSource, 'remote'> = {},
): ModuleFederationSource {
  const source = { ...options, remote };
  assertModuleFederationSource(source);
  return source;
}

export function toModuleFederationId(
  source: ModuleFederationSource,
  ref: NormalizedAppRef,
): string {
  const expose = ref.expose.replace(/^\.\//, '');
  if (expose === '') {
    throw new FrontsError(
      frontsErrorCodes.loadFailed,
      `Application "${ref.name}" has an empty Module Federation expose.`,
      { phase: 'load' },
    );
  }
  return `${source.remote.name}/${expose}`;
}
