export {
  FRONTS_APP_PROTOCOL,
  FRONTS_APP_PROTOCOL_VERSION,
  FRONTS_APP_SYMBOL,
  assertAppHandle,
  assertFrontsApp,
  defineApp,
  getFrontsApp,
  isFrontsApp,
  isFrontsAppModule,
} from './app/index.js';
export type {
  AppHandle,
  ApplicationIdentity,
  FrontsApp,
  FrontsAppDefinition,
  FrontsAppModule,
  MaybePromise,
  MountContext,
  MountTarget,
  ServiceKey,
} from './app/index.js';
export {
  FrontsError,
  createAbortedError,
  frontsErrorCodes,
  isFrontsError,
  throwIfAborted,
} from './errors.js';
export type { FrontsErrorCode, FrontsErrorOptions, FrontsPhase } from './errors.js';
export {
  MemoryResolutionCache,
  assertResolvedApp,
  createCachedResolver,
  createFallbackResolver,
  createRegistryResolver,
  createResolutionCacheKey,
  createStaticResolver,
  normalizeAppRef,
} from './resolver/index.js';
export type {
  AppRef,
  AppResolver,
  CachedResolverOptions,
  NormalizedAppRef,
  RegistryRequestContext,
  RegistryResolverOptions,
  ResolutionCache,
  ResolutionCacheEntry,
  ResolveContext,
  ResolveFunction,
  ResolvedApp,
  ResolvedAppInit,
  StaticResolution,
  StaticResolutionMatch,
} from './resolver/index.js';
