import { FrontsError, frontsErrorCodes } from '../errors.js';
import type { AppRef, NormalizedAppRef, ResolvedApp } from './types.js';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchesRef(value: unknown, expected: NormalizedAppRef): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.name === expected.name &&
    value.expose === expected.expose &&
    value.range === expected.range &&
    value.channel === expected.channel
  );
}

function normalizeOptional(value: unknown, property: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new FrontsError(
      frontsErrorCodes.resolutionFailed,
      `AppRef.${property} must be a string when provided.`,
      { details: { property }, phase: 'resolve' },
    );
  }
  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
}

export function normalizeAppRef(ref: AppRef): NormalizedAppRef {
  if (!isRecord(ref) || typeof ref.name !== 'string') {
    throw new FrontsError(frontsErrorCodes.resolutionFailed, 'AppRef must contain a string name.', {
      details: { property: 'name' },
      phase: 'resolve',
    });
  }
  const name = ref.name.trim();
  if (name === '' || /\s/.test(name)) {
    throw new FrontsError(
      frontsErrorCodes.resolutionFailed,
      'AppRef.name must be a non-empty value without whitespace.',
      { phase: 'resolve' },
    );
  }

  const expose = normalizeOptional(ref.expose, 'expose') ?? './application';
  if (!expose.startsWith('./')) {
    throw new FrontsError(
      frontsErrorCodes.resolutionFailed,
      'AppRef.expose must start with "./".',
      { details: { expose }, phase: 'resolve' },
    );
  }

  const range = normalizeOptional(ref.range, 'range');
  const channel = normalizeOptional(ref.channel, 'channel');

  return Object.freeze({
    name,
    expose,
    ...(range === undefined ? {} : { range }),
    ...(channel === undefined ? {} : { channel }),
  });
}

export function assertResolvedApp<Source>(
  value: unknown,
  expectedRef: NormalizedAppRef,
): asserts value is ResolvedApp<Source> {
  if (!isRecord(value) || !('source' in value)) {
    throw new FrontsError(
      frontsErrorCodes.resolutionFailed,
      `Resolver returned an invalid result for "${expectedRef.name}".`,
      { phase: 'resolve' },
    );
  }

  const result = value as Partial<ResolvedApp<Source>>;
  if (result.source === undefined || result.source === null) {
    throw new FrontsError(
      frontsErrorCodes.resolutionFailed,
      `Resolver did not provide a source for "${expectedRef.name}".`,
      { phase: 'resolve' },
    );
  }
  if (!matchesRef(result.ref, expectedRef)) {
    throw new FrontsError(
      frontsErrorCodes.resolutionFailed,
      `Resolver returned a mismatched reference for "${expectedRef.name}".`,
      { details: { expectedRef, receivedRef: result.ref }, phase: 'resolve' },
    );
  }
  if (
    result.version !== undefined &&
    (typeof result.version !== 'string' ||
      result.version.trim() === '' ||
      result.version !== result.version.trim())
  ) {
    throw new FrontsError(
      frontsErrorCodes.resolutionFailed,
      `Resolver returned an invalid version for "${expectedRef.name}".`,
      { details: { version: result.version }, phase: 'resolve' },
    );
  }
  if (result.metadata !== undefined && !isRecord(result.metadata)) {
    throw new FrontsError(
      frontsErrorCodes.resolutionFailed,
      `Resolver returned invalid metadata for "${expectedRef.name}".`,
      { phase: 'resolve' },
    );
  }
}
