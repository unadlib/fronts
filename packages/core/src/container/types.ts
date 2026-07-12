import type { ApplicationIdentity, MaybePromise, MountTarget } from '../app/index.js';
import type { ApplicationHostOperationContext } from '../operation/index.js';
import type { ResolutionPolicyContext, ResolvedApp } from '../resolver/index.js';

export type ContainerHostTarget = Element | ShadowRoot;

export interface ContainerRequest {
  readonly type: string;
}

export interface DomContainerRequest extends ContainerRequest {
  readonly type: 'dom';
  readonly tagName?: string;
  readonly className?: string;
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface ShadowContainerRequest extends ContainerRequest {
  readonly type: 'shadow';
  readonly tagName?: string;
  readonly className?: string;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly mode?: ShadowRootMode;
  readonly delegatesFocus?: boolean;
}

export type BuiltInContainerRequest = DomContainerRequest | ShadowContainerRequest;

export interface ContainerPlanContext<Source = unknown> {
  readonly identity: ApplicationIdentity;
  readonly operation: ApplicationHostOperationContext;
  readonly resolution: Readonly<ResolutionPolicyContext>;
  readonly resolved: ResolvedApp<Source>;
  readonly signal: AbortSignal;
  readonly target: ContainerHostTarget;
}

export type ContainerRequestResolver<
  Source,
  Request extends ContainerRequest = ContainerRequest,
> = (context: ContainerPlanContext<Source>) => MaybePromise<Request>;

export interface ContainerPrepareContext<
  Request extends ContainerRequest = ContainerRequest,
  Source = unknown,
> {
  readonly identity: ApplicationIdentity;
  readonly operation: ApplicationHostOperationContext;
  readonly request: Request;
  readonly resolved: ResolvedApp<Source>;
  readonly signal: AbortSignal;
  readonly target: ContainerHostTarget;
}

export interface PreparedContainer {
  readonly type: string;
  readonly element: Element;
  /** Whether dispose() is expected to detach element from its parent. */
  readonly ownsElement?: boolean;
  readonly target: MountTarget;
  dispose(): MaybePromise<void>;
}

export interface ContainerAdapter<
  Request extends ContainerRequest = ContainerRequest,
  Source = unknown,
> {
  readonly type: Request['type'];
  prepare(context: ContainerPrepareContext<Request, Source>): MaybePromise<PreparedContainer>;
}
