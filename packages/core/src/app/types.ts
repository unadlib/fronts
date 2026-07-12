import type { FRONTS_APP_PROTOCOL, FRONTS_APP_PROTOCOL_VERSION } from './constants.js';

export type MaybePromise<Value> = Value | PromiseLike<Value>;

export type MountTarget = Element | ShadowRoot;

export type ServiceKey<Services extends object> = Extract<keyof Services, string>;

export interface ApplicationIdentity {
  readonly instanceId: string;
  readonly name: string;
  readonly version?: string;
  readonly expose?: string;
  readonly traceId?: string;
}

export interface MountContext<Props, Services extends object> {
  readonly identity: ApplicationIdentity;
  readonly props: Readonly<Props>;
  readonly services: Readonly<Services>;
  readonly signal: AbortSignal;
  readonly target: MountTarget;
}

export interface AppHandle<Props = unknown> {
  readonly ready?: PromiseLike<void>;
  activate?(): MaybePromise<void>;
  deactivate?(): MaybePromise<void>;
  update?(props: Readonly<Props>): MaybePromise<void>;
  unmount(): MaybePromise<void>;
}

export interface FrontsApp<Props = unknown, Services extends object = object> {
  readonly protocol: typeof FRONTS_APP_PROTOCOL;
  readonly protocolVersion: typeof FRONTS_APP_PROTOCOL_VERSION;
  readonly name?: string;
  readonly capabilities?: readonly ServiceKey<Services>[];
  mount(context: MountContext<Props, Services>): MaybePromise<AppHandle<Props>>;
}

export type FrontsAppDefinition<Props = unknown, Services extends object = object> = Omit<
  FrontsApp<Props, Services>,
  'protocol' | 'protocolVersion'
>;

export interface FrontsAppModule<Props = unknown, Services extends object = object> {
  readonly default: FrontsApp<Props, Services>;
}
