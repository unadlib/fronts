import { FrontsError, frontsErrorCodes, throwIfAborted } from '../errors.js';
import type { AppResolver, NormalizedAppRef, ResolveContext, ResolvedApp } from './types.js';

export interface ResolutionCacheEntry<Source> {
  readonly value: ResolvedApp<Source>;
  readonly expiresAt: number;
  readonly staleUntil: number;
}

export interface ResolutionCache<Source> {
  delete(key: string): void | PromiseLike<void>;
  get(
    key: string,
  ):
    | ResolutionCacheEntry<Source>
    | undefined
    | PromiseLike<ResolutionCacheEntry<Source> | undefined>;
  set(key: string, entry: ResolutionCacheEntry<Source>): void | PromiseLike<void>;
}

export class MemoryResolutionCache<Source> implements ResolutionCache<Source> {
  readonly #entries = new Map<string, ResolutionCacheEntry<Source>>();

  delete(key: string): void {
    this.#entries.delete(key);
  }

  get(key: string): ResolutionCacheEntry<Source> | undefined {
    return this.#entries.get(key);
  }

  set(key: string, entry: ResolutionCacheEntry<Source>): void {
    this.#entries.set(key, entry);
  }

  clear(): void {
    this.#entries.clear();
  }
}

export interface CachedResolverOptions<Source> {
  readonly resolver: AppResolver<Source>;
  readonly cache?: ResolutionCache<Source>;
  readonly ttlMs?: number;
  readonly staleTtlMs?: number;
  readonly now?: () => number;
  readonly key?: (ref: NormalizedAppRef, context: ResolveContext) => string;
}

export function createResolutionCacheKey(ref: NormalizedAppRef, context: ResolveContext): string {
  return JSON.stringify([
    ref.name,
    ref.expose,
    ref.range ?? null,
    ref.channel ?? null,
    context.environment ?? null,
    context.tenant ?? null,
    context.cohort ?? null,
  ]);
}

function validateDuration(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new FrontsError(
      frontsErrorCodes.resolutionFailed,
      `${name} must be a finite, non-negative duration.`,
      { phase: 'resolve' },
    );
  }
}

export function createCachedResolver<Source>(
  options: CachedResolverOptions<Source>,
): AppResolver<Source> {
  const ttlMs = options.ttlMs ?? 30_000;
  const staleTtlMs = options.staleTtlMs ?? 300_000;
  validateDuration(ttlMs, 'ttlMs');
  validateDuration(staleTtlMs, 'staleTtlMs');

  const cache = options.cache ?? new MemoryResolutionCache<Source>();
  const now = options.now ?? Date.now;
  const getKey = options.key ?? createResolutionCacheKey;

  return {
    async resolve(ref, context): Promise<ResolvedApp<Source>> {
      throwIfAborted(context.signal, 'resolve');
      const key = getKey(ref, context);
      const cached = await cache.get(key);
      const currentTime = now();

      if (cached !== undefined && currentTime < cached.expiresAt) {
        return cached.value;
      }

      try {
        const value = await options.resolver.resolve(ref, context);
        const expiresAt = now() + ttlMs;
        await cache.set(key, {
          expiresAt,
          staleUntil: expiresAt + staleTtlMs,
          value,
        });
        return value;
      } catch (error) {
        throwIfAborted(context.signal, 'resolve');
        if (cached !== undefined && now() < cached.staleUntil) {
          return cached.value;
        }
        throw error;
      }
    },
  };
}
