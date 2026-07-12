import { FrontsError, frontsErrorCodes, throwIfAborted } from '../errors.js';
import type {
  AppResolver,
  NormalizedAppRef,
  ResolveContext,
  ResolvedApp,
  ResolvedAppInit,
} from './types.js';
import { assertResolvedApp } from './validation.js';

export interface RegistryRequestContext {
  readonly ref: NormalizedAppRef;
  readonly context: ResolveContext;
}

export interface RegistryResolverOptions<Source> {
  readonly endpoint:
    string | ((request: RegistryRequestContext) => string | URL | PromiseLike<string | URL>);
  readonly fetch?: typeof globalThis.fetch;
  readonly headers?:
    HeadersInit | ((request: RegistryRequestContext) => HeadersInit | PromiseLike<HeadersInit>);
  readonly credentials?: RequestCredentials;
  readonly decode?: (
    payload: unknown,
    request: RegistryRequestContext,
  ) => ResolvedAppInit<Source> | PromiseLike<ResolvedAppInit<Source>>;
}

function appendQuery(endpoint: string | URL, request: RegistryRequestContext): string {
  const query = new URLSearchParams({
    expose: request.ref.expose,
    name: request.ref.name,
  });

  const values: ReadonlyArray<readonly [string, string | undefined]> = [
    ['range', request.ref.range],
    ['channel', request.ref.channel],
    ['environment', request.context.environment],
    ['tenant', request.context.tenant],
    ['cohort', request.context.cohort],
  ];

  for (const [key, value] of values) {
    if (value !== undefined) {
      query.set(key, value);
    }
  }

  const serialized = String(endpoint);
  const hashIndex = serialized.indexOf('#');
  const base = hashIndex === -1 ? serialized : serialized.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : serialized.slice(hashIndex);
  const separator = base.includes('?')
    ? base.endsWith('?') || base.endsWith('&')
      ? ''
      : '&'
    : '?';
  return `${base}${separator}${query.toString()}${fragment}`;
}

function decodeRegistryPayload<Source>(payload: unknown): ResolvedAppInit<Source> {
  if (typeof payload !== 'object' || payload === null || !('source' in payload)) {
    throw new FrontsError(
      frontsErrorCodes.resolutionFailed,
      'Registry response must contain a source.',
      { phase: 'resolve' },
    );
  }

  return payload as ResolvedAppInit<Source>;
}

export function createRegistryResolver<Source = unknown>(
  options: RegistryResolverOptions<Source>,
): AppResolver<Source> {
  const requestFetch = options.fetch ?? globalThis.fetch;
  if (requestFetch === undefined) {
    throw new FrontsError(
      frontsErrorCodes.resolutionFailed,
      'No Fetch API implementation is available for the registry resolver.',
      { phase: 'resolve' },
    );
  }

  return {
    async resolve(ref, context): Promise<ResolvedApp<Source>> {
      throwIfAborted(context.signal, 'resolve');
      const request = { context, ref };

      try {
        const endpoint =
          typeof options.endpoint === 'function'
            ? await options.endpoint(request)
            : options.endpoint;
        throwIfAborted(context.signal, 'resolve');
        const headers =
          typeof options.headers === 'function' ? await options.headers(request) : options.headers;
        throwIfAborted(context.signal, 'resolve');
        const url = appendQuery(endpoint, request);
        const response = await requestFetch(url, {
          ...(options.credentials === undefined ? {} : { credentials: options.credentials }),
          ...(headers === undefined ? {} : { headers }),
          method: 'GET',
          signal: context.signal,
        });
        throwIfAborted(context.signal, 'resolve');

        if (!response.ok) {
          throw new FrontsError(
            frontsErrorCodes.resolutionFailed,
            `Registry request for "${ref.name}" failed with HTTP ${response.status}.`,
            {
              details: { status: response.status, url },
              phase: 'resolve',
            },
          );
        }

        const payload: unknown = await response.json();
        throwIfAborted(context.signal, 'resolve');
        const decoded = await (options.decode ?? decodeRegistryPayload<Source>)(payload, request);
        throwIfAborted(context.signal, 'resolve');
        const result = { ...decoded, ref };
        assertResolvedApp<Source>(result, ref);
        throwIfAborted(context.signal, 'resolve');
        return result;
      } catch (error) {
        if (context.signal.aborted) {
          throwIfAborted(context.signal, 'resolve');
        }
        if (error instanceof FrontsError) {
          throw error;
        }
        throw new FrontsError(
          frontsErrorCodes.resolutionFailed,
          `Registry resolution failed for "${ref.name}".`,
          { cause: error, phase: 'resolve' },
        );
      }
    },
  };
}
