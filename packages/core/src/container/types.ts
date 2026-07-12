import type { ApplicationIdentity, MaybePromise, MountTarget } from '../app/index.js';

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

export interface ContainerPrepareContext<Request extends ContainerRequest = ContainerRequest> {
  readonly identity: ApplicationIdentity;
  readonly request: Request;
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

export interface ContainerAdapter<Request extends ContainerRequest = ContainerRequest> {
  readonly type: Request['type'];
  prepare(context: ContainerPrepareContext<Request>): MaybePromise<PreparedContainer>;
}
