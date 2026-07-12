import { FrontsError, frontsErrorCodes, type NormalizedAppRef } from '@fronts/core';
import type { Remote } from '@module-federation/runtime/types';

import type { ModuleFederationSource } from './types.js';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTrimmedString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value === value.trim();
}

function hasOwn(value: object, property: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
}

function invalidSourceField(field: string): FrontsError {
  return new FrontsError(
    frontsErrorCodes.loadFailed,
    `Module Federation source field "${field}" is invalid.`,
    { details: { field }, phase: 'load' },
  );
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
  if (!hasOwn(remote, 'name') || !isTrimmedString(remote.name) || /\s/.test(remote.name)) {
    throw invalidSourceField('remote.name');
  }
  const hasEntry = hasOwn(remote, 'entry');
  const hasVersion = hasOwn(remote, 'version');
  if ('entry' in remote && !hasEntry) {
    throw invalidSourceField('remote.entry');
  }
  if ('version' in remote && !hasVersion) {
    throw invalidSourceField('remote.version');
  }
  if (hasEntry && !isTrimmedString(remote.entry)) {
    throw invalidSourceField('remote.entry');
  }
  if (hasVersion && !isTrimmedString(remote.version)) {
    throw invalidSourceField('remote.version');
  }
  if (hasEntry === hasVersion) {
    throw new FrontsError(
      frontsErrorCodes.loadFailed,
      `Module Federation remote "${remote.name}" must provide exactly one of entry or version.`,
      { details: { field: 'remote' }, phase: 'load' },
    );
  }
  if (
    remote.alias !== undefined &&
    (!hasOwn(remote, 'alias') || !isTrimmedString(remote.alias) || /\s/.test(remote.alias))
  ) {
    throw invalidSourceField('remote.alias');
  }
  if (
    remote.shareScope !== undefined &&
    (!hasOwn(remote, 'shareScope') ||
      !(
        isTrimmedString(remote.shareScope) ||
        (Array.isArray(remote.shareScope) &&
          remote.shareScope.length > 0 &&
          remote.shareScope.every(isTrimmedString))
      ))
  ) {
    throw invalidSourceField('remote.shareScope');
  }
  if (remote.type !== undefined && (!hasOwn(remote, 'type') || !isTrimmedString(remote.type))) {
    throw invalidSourceField('remote.type');
  }
  if (
    remote.entryGlobalName !== undefined &&
    (!hasOwn(remote, 'entryGlobalName') || !isTrimmedString(remote.entryGlobalName))
  ) {
    throw invalidSourceField('remote.entryGlobalName');
  }
  if (
    source.force !== undefined &&
    (!hasOwn(source, 'force') || typeof source.force !== 'boolean')
  ) {
    throw invalidSourceField('force');
  }
  if (source.preload !== undefined && (!hasOwn(source, 'preload') || !isRecord(source.preload))) {
    throw invalidSourceField('preload');
  }
}

export function createModuleFederationSource(
  remote: Remote,
  options: Omit<ModuleFederationSource, 'remote'> = {},
): ModuleFederationSource {
  const source = Object.freeze({
    ...options,
    ...(options.preload === undefined ? {} : { preload: Object.freeze({ ...options.preload }) }),
    remote: Object.freeze({
      ...remote,
      ...(Array.isArray(remote.shareScope)
        ? { shareScope: Object.freeze([...remote.shareScope]) }
        : {}),
    }) as Remote,
  });
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
