import { FrontsError, frontsErrorCodes } from '../errors.js';
import type { AppRef, NormalizedAppRef, ResolvedApp } from './types.js';

function copyOptional(property: string | undefined): string | undefined {
  const normalized = property?.trim();
  return normalized === '' ? undefined : normalized;
}

export function normalizeAppRef(ref: AppRef): NormalizedAppRef {
  const name = ref.name.trim();
  if (name === '' || /\s/.test(name)) {
    throw new FrontsError(
      frontsErrorCodes.resolutionFailed,
      'AppRef.name must be a non-empty value without whitespace.',
      { phase: 'resolve' },
    );
  }

  const expose = copyOptional(ref.expose) ?? './application';
  if (!expose.startsWith('./')) {
    throw new FrontsError(
      frontsErrorCodes.resolutionFailed,
      'AppRef.expose must start with "./".',
      { details: { expose }, phase: 'resolve' },
    );
  }

  const range = copyOptional(ref.range);
  const channel = copyOptional(ref.channel);

  return {
    name,
    expose,
    ...(range === undefined ? {} : { range }),
    ...(channel === undefined ? {} : { channel }),
  };
}

export function assertResolvedApp<Source>(
  value: unknown,
  expectedRef: NormalizedAppRef,
): asserts value is ResolvedApp<Source> {
  if (typeof value !== 'object' || value === null || !('source' in value)) {
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
}
