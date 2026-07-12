import type { AppHandle, ApplicationIdentity, FrontsApp, MaybePromise } from '../app/index.js';
import type {
  BuiltInContainerRequest,
  ContainerAdapter,
  ContainerHostTarget,
  ContainerRegistry,
  ContainerRequest,
  ContainerRequestResolver,
  PreparedContainer,
} from '../container/index.js';
import type { FrontsError, FrontsPhase } from '../errors.js';
import type { HostOperationContext, HostOperationIntent } from '../operation/index.js';
import type {
  AppRef,
  AppResolver,
  NormalizedAppRef,
  ResolutionPolicyContext,
  ResolvedApp,
} from '../resolver/index.js';
import type { CapabilityPolicy, ServiceProvider, ServiceScope } from '../services/index.js';

export type AppLoadContext = HostOperationContext;

export interface AppLoader<Source> {
  load(resolved: ResolvedApp<Source>, context: AppLoadContext): MaybePromise<unknown>;
  preload?(resolved: ResolvedApp<Source>, context: AppLoadContext): MaybePromise<void>;
}

export interface LoadedApp<Props = unknown, Services extends object = object, Source = unknown> {
  readonly app: FrontsApp<Props, Services>;
  readonly resolved: ResolvedApp<Source>;
}

export type HostResolveOptions = ResolutionPolicyContext & {
  readonly operationId?: string;
  readonly signal?: AbortSignal;
  readonly traceId?: string;
};

export type MountResolveOptions = ResolutionPolicyContext;

export interface MountAppOptions<
  Props,
  Request extends ContainerRequest = BuiltInContainerRequest,
  Source = unknown,
> {
  readonly ref: AppRef;
  readonly target: ContainerHostTarget;
  readonly props: Props;
  readonly container?: Request | ContainerRequestResolver<Source, Request>;
  readonly instanceId?: string;
  readonly operationId?: string;
  readonly readyTimeoutMs?: number;
  readonly resolve?: MountResolveOptions;
  readonly signal?: AbortSignal;
  readonly traceId?: string;
}

export type ReplaceAppOptions<
  Props,
  Request extends ContainerRequest = BuiltInContainerRequest,
  Source = unknown,
> = MountAppOptions<Props, Request, Source>;

export type AppInstanceState =
  | 'resolving'
  | 'loading'
  | 'preparing'
  | 'mounting'
  | 'ready'
  | 'updating'
  | 'active'
  | 'inactive'
  | 'unmounting'
  | 'destroyed'
  | 'failed'
  | 'aborted';

export interface ApplicationInstanceSnapshot<Source = unknown> {
  readonly identity: ApplicationIdentity;
  readonly ref: NormalizedAppRef;
  readonly intent: Extract<HostOperationIntent, 'mount' | 'replace'>;
  readonly operationId: string;
  readonly state: AppInstanceState;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly containerType?: string;
  readonly resolved?: ResolvedApp<Source>;
  readonly error?: FrontsError;
  readonly cleanupError?: FrontsError;
}

export interface HostStateEvent<Source = unknown> {
  readonly kind: 'state';
  readonly hostId: string;
  readonly sequence: number;
  readonly snapshot: ApplicationInstanceSnapshot<Source>;
  readonly previousState?: AppInstanceState;
  readonly phase?: FrontsPhase;
  readonly durationMs: number;
  readonly timestamp: number;
}

export interface HostErrorEvent<Source = unknown> {
  readonly kind: 'error';
  readonly hostId: string;
  readonly sequence: number;
  readonly snapshot: ApplicationInstanceSnapshot<Source>;
  readonly error: FrontsError;
  readonly phase: FrontsPhase;
  readonly timestamp: number;
}

export type HostEvent<Source = unknown> = HostErrorEvent<Source> | HostStateEvent<Source>;

export type HostEventListener<Source = unknown> = (event: HostEvent<Source>) => void;

export interface MountedApplication<Props = unknown, Source = unknown> {
  readonly identity: ApplicationIdentity;
  readonly ref: NormalizedAppRef;
  readonly resolved: ResolvedApp<Source>;
  readonly ready: Promise<void>;
  readonly state: AppInstanceState;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  update(props: Props): Promise<void>;
  unmount(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
}

export interface ReplacementResult<Props = unknown, Source = unknown> {
  readonly application: MountedApplication<Props, Source>;
  readonly previous: ApplicationIdentity;
  readonly previousCleanupError?: FrontsError;
}

export interface FrontsHostOptions<Source, Services extends object> {
  readonly resolver: AppResolver<Source>;
  readonly loader: AppLoader<Source>;
  readonly services?: Services;
  readonly createServices?: ServiceProvider<Source, Services>;
  readonly capabilityPolicy?: CapabilityPolicy<Services>;
  readonly containers?: ContainerRegistry | readonly ContainerAdapter[];
  readonly containerLoaders?: Readonly<Record<string, AppLoader<Source>>>;
  readonly readyTimeoutMs?: number;
  readonly createInstanceId?: (ref: NormalizedAppRef) => string;
  readonly createOperationId?: (intent: HostOperationIntent, ref: NormalizedAppRef) => string;
  readonly createTraceId?: (ref: NormalizedAppRef, instanceId: string) => string;
  readonly hostId?: string;
  readonly now?: () => number;
  readonly observer?: HostEventListener<Source>;
}

export interface RetainedContainerSnapshot {
  readonly containerType?: string;
  readonly identity: ApplicationIdentity;
  readonly state: AppInstanceState;
}

export interface HostAuditReport<Source = unknown> {
  readonly activeInstances: readonly ApplicationInstanceSnapshot<Source>[];
  readonly cleanupFailures: readonly ApplicationInstanceSnapshot<Source>[];
  readonly hostId: string;
  readonly idle: boolean;
  readonly pendingOperations: number;
  readonly replacementTransactions: readonly string[];
  readonly retainedContainers: readonly RetainedContainerSnapshot[];
}

export interface FrontsHost<Source, Services extends object> {
  readonly id: string;
  resolve(ref: AppRef, options?: HostResolveOptions): Promise<ResolvedApp<Source>>;
  load<Props = unknown>(
    ref: AppRef,
    options?: HostResolveOptions,
  ): Promise<LoadedApp<Props, Services, Source>>;
  preload(ref: AppRef, options?: HostResolveOptions): Promise<ResolvedApp<Source>>;
  mount<Props, Request extends ContainerRequest = BuiltInContainerRequest>(
    options: MountAppOptions<Props, Request, Source>,
  ): Promise<MountedApplication<Props, Source>>;
  replace<Props, Request extends ContainerRequest = BuiltInContainerRequest>(
    currentInstanceId: string,
    options: ReplaceAppOptions<Props, Request, Source>,
  ): Promise<ReplacementResult<Props, Source>>;
  get(instanceId: string): MountedApplication<unknown, Source> | undefined;
  inspect(): readonly ApplicationInstanceSnapshot<Source>[];
  audit(): HostAuditReport<Source>;
  assertIdle(): void;
  subscribe(listener: HostEventListener<Source>): () => void;
  unmount(instanceId: string): Promise<void>;
  dispose(): Promise<void>;
}

export interface MountedApplicationResources<Props, Services extends object, Source> {
  readonly controller: AbortController;
  readonly appHandle: AppHandle<Props>;
  readonly container: PreparedContainer;
  readonly identity: ApplicationIdentity;
  readonly ref: NormalizedAppRef;
  readonly resolved: ResolvedApp<Source>;
  readonly scope: ServiceScope<Partial<Services>>;
}
