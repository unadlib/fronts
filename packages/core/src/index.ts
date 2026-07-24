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
  ContainerRegistry,
  createContainerRegistry,
  createDomContainer,
  createShadowContainer,
} from './container/index.js';
export type {
  BuiltInContainerRequest,
  ContainerAdapter,
  ContainerHostTarget,
  ContainerPlanContext,
  ContainerPrepareContext,
  ContainerRequest,
  ContainerRequestResolver,
  DomContainerRequest,
  PreparedContainer,
  ShadowContainerRequest,
} from './container/index.js';
export type {
  ApplicationCatalog,
  ApplicationContractShape,
  ApplicationName,
  HostComposition,
} from './composition.js';
export {
  FrontsError,
  createAbortedError,
  frontsErrorCodes,
  isFrontsError,
  throwIfAborted,
} from './errors.js';
export type { FrontsErrorCode, FrontsErrorOptions, FrontsPhase } from './errors.js';
export { FrontsHostImpl, MountedApplicationImpl, createFrontsHost } from './host/index.js';
export type {
  AppInstanceState,
  AppLoadContext,
  AppLoader,
  ApplicationInstanceSnapshot,
  FrontsHost,
  FrontsHostOptions,
  HostErrorEvent,
  HostAuditReport,
  HostEvent,
  HostEventListener,
  HostResolveOptions,
  HostStateEvent,
  LoadedApp,
  MountAppOptions,
  MountResolveOptions,
  MountedApplication,
  MountedApplicationCallbacks,
  ReplaceAppOptions,
  ReplacementResult,
  RetainedContainerSnapshot,
} from './host/index.js';
export { createModuleHost } from './moduleHost.js';
export type {
  AppModuleDeployment,
  AppModuleEntry,
  AppModuleImport,
  AppModuleMap,
  AppModuleSource,
  ModuleContracts,
  ModuleHostOptions,
  ModuleHostResult,
} from './moduleHost.js';
export type {
  ApplicationHostOperationContext,
  DetachedHostOperationContext,
  HostOperationContext,
  HostOperationIntent,
} from './operation/index.js';
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
  ResolutionPolicyContext,
  ResolveContext,
  ResolveFunction,
  ResolvedApp,
  ResolvedAppInit,
  StaticResolution,
  StaticResolutionMatch,
} from './resolver/index.js';
export { createServiceScope } from './services/index.js';
export type {
  CapabilityPolicy,
  CapabilityPolicyContext,
  CreateServiceScopeOptions,
  ServiceProvider,
  ServiceProviderContext,
  ServiceProviderResult,
  ServiceScope,
} from './services/index.js';
