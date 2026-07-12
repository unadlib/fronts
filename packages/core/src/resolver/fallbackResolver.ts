import { FrontsError, frontsErrorCodes, throwIfAborted } from '../errors.js';
import type { AppResolver } from './types.js';

export function createFallbackResolver<Source>(
  resolvers: readonly AppResolver<Source>[],
): AppResolver<Source> {
  if (resolvers.length === 0) {
    throw new FrontsError(frontsErrorCodes.resolutionFailed, 'At least one resolver is required.', {
      phase: 'resolve',
    });
  }

  return {
    async resolve(ref, context) {
      let lastError: unknown;
      for (const resolver of resolvers) {
        throwIfAborted(context.signal, 'resolve');
        try {
          return await resolver.resolve(ref, context);
        } catch (error) {
          throwIfAborted(context.signal, 'resolve');
          lastError = error;
        }
      }

      throw new FrontsError(
        frontsErrorCodes.resolutionFailed,
        `Every resolver failed for "${ref.name}".`,
        { cause: lastError, details: { attempts: resolvers.length }, phase: 'resolve' },
      );
    },
  };
}
