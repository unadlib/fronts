import { FrontsError, frontsErrorCodes, throwIfAborted } from '../errors.js';
import type {
  AppResolver,
  NormalizedAppRef,
  ResolveContext,
  ResolvedApp,
  ResolvedAppInit,
} from './types.js';

export interface StaticResolutionMatch {
  readonly name: string;
  readonly expose?: string;
  readonly range?: string;
  readonly channel?: string;
  readonly environment?: string;
  readonly tenant?: string;
  readonly cohort?: string;
}

export interface StaticResolution<Source> {
  readonly match: StaticResolutionMatch;
  readonly resolve:
    | ResolvedAppInit<Source>
    | ((ref: NormalizedAppRef, context: ResolveContext) => ResolvedAppInit<Source>);
}

function matches(
  selector: StaticResolutionMatch,
  ref: NormalizedAppRef,
  context: ResolveContext,
): boolean {
  return (
    selector.name === ref.name &&
    (selector.expose === undefined || selector.expose === ref.expose) &&
    (selector.range === undefined || selector.range === ref.range) &&
    (selector.channel === undefined || selector.channel === ref.channel) &&
    (selector.environment === undefined || selector.environment === context.environment) &&
    (selector.tenant === undefined || selector.tenant === context.tenant) &&
    (selector.cohort === undefined || selector.cohort === context.cohort)
  );
}

export function createStaticResolver<Source>(
  resolutions: readonly StaticResolution<Source>[],
): AppResolver<Source> {
  return {
    resolve(ref, context): ResolvedApp<Source> {
      throwIfAborted(context.signal, 'resolve');
      const resolution = resolutions.find((candidate) => matches(candidate.match, ref, context));

      if (resolution === undefined) {
        throw new FrontsError(
          frontsErrorCodes.resolutionFailed,
          `No static resolution matched "${ref.name}".`,
          { details: { ref }, phase: 'resolve' },
        );
      }

      const result =
        typeof resolution.resolve === 'function'
          ? resolution.resolve(ref, context)
          : resolution.resolve;

      throwIfAborted(context.signal, 'resolve');
      return { ...result, ref };
    },
  };
}
