import type { AppHandle, ApplicationIdentity, FrontsApp, MaybePromise } from '../app/index.js';
import type {
  BuiltInContainerRequest,
  ContainerAdapter,
  ContainerHostTarget,
  ContainerRegistry,
  ContainerRequest,
  PreparedContainer,
} from '../container/index.js';
import type { FrontsError, FrontsPhase } from '../errors.js';
import type {
  AppRef,
  AppResolver,
  NormalizedAppRef,
  ResolveContext,
  ResolvedApp,
} from '../resolver/index.js';
import type { CapabilityPolicy, ServiceScope } from '../services/index.js';

export interface AppLoadContext {
  readonly signal: AbortSignal;
}

export interface AppLoader<Source> {
  load(resolved: ResolvedApp<Source>, context: AppLoadContext): MaybePromise<unknown>;
  preload?(resolved: ResolvedApp<Source>, context: AppLoadContext): MaybePromise<void>;
}

export interface LoadedApp<Props = unknown, Services extends object = object, Source = unknown> {
  readonly app: FrontsApp<Props, Services>;
  readonly resolved: ResolvedApp<Source>;
}

export type HostResolveOptions = Omit<ResolveContext, 'signal'> & {
  readonly signal?: AbortSignal;
};

export type MountResolveOptions = Omit<ResolveContext, 'signal'>;

export interface MountAppOptions<
  Props,
  Request extends ContainerRequest = BuiltInContainerRequest,
> {
  readonly ref: AppRef;
  readonly target: ContainerHostTarget;
  readonly props: Props;
  readonly container?: Request;
  readonly instanceId?: string;
  readonly readyTimeoutMs?: number;
  readonly resolve?: MountResolveOptions;
  readonly signal?: AbortSignal;
}

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
  readonly state: AppInstanceState;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly containerType?: string;
  readonly resolved?: ResolvedApp<Source>;
  readonly error?: FrontsError;
}

export interface HostStateEvent<Source = unknown> {
  readonly kind: 'state';
  readonly snapshot: ApplicationInstanceSnapshot<Source>;
  readonly previousState?: AppInstanceState;
  readonly phase?: FrontsPhase;
  readonly timestamp: number;
}

export interface HostErrorEvent<Source = unknown> {
  readonly kind: 'error';
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

export interface FrontsHostOptions<Source, Services extends object> {
  readonly resolver: AppResolver<Source>;
  readonly loader: AppLoader<Source>;
  readonly services?: Services;
  readonly capabilityPolicy?: CapabilityPolicy<Services>;
  readonly containers?: ContainerRegistry | readonly ContainerAdapter[];
  readonly readyTimeoutMs?: number;
  readonly createInstanceId?: (ref: NormalizedAppRef) => string;
  readonly now?: () => number;
  readonly observer?: HostEventListener<Source>;
}

export interface FrontsHost<Source, Services extends object> {
  resolve(ref: AppRef, options?: HostResolveOptions): Promise<ResolvedApp<Source>>;
  load<Props = unknown>(
    ref: AppRef,
    options?: HostResolveOptions,
  ): Promise<LoadedApp<Props, Services, Source>>;
  preload(ref: AppRef, options?: HostResolveOptions): Promise<ResolvedApp<Source>>;
  mount<Props, Request extends ContainerRequest = BuiltInContainerRequest>(
    options: MountAppOptions<Props, Request>,
  ): Promise<MountedApplication<Props, Source>>;
  get(instanceId: string): MountedApplication<unknown, Source> | undefined;
  inspect(): readonly ApplicationInstanceSnapshot<Source>[];
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
