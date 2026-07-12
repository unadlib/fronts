import type { ApplicationIdentity, MaybePromise, ServiceKey } from '../app/index.js';
import type { ApplicationHostOperationContext } from '../operation/index.js';
import type { ResolutionPolicyContext, ResolvedApp } from '../resolver/index.js';

export interface CapabilityPolicyContext<Services extends object> {
  readonly capability: ServiceKey<Services>;
  readonly identity: ApplicationIdentity;
  readonly service: Services[ServiceKey<Services>];
  readonly signal: AbortSignal;
}

export type CapabilityPolicy<Services extends object> = (
  context: CapabilityPolicyContext<Services>,
) => MaybePromise<boolean>;

export interface ServiceScope<ScopedServices extends object> {
  readonly services: Readonly<ScopedServices>;
  readonly revoked: boolean;
  dispose(): Promise<void>;
  revoke(): void;
}

export interface ServiceProviderContext<Source, Services extends object> {
  readonly capabilities: readonly ServiceKey<Services>[];
  readonly hostId: string;
  readonly identity: ApplicationIdentity;
  readonly operation: ApplicationHostOperationContext;
  readonly resolution: Readonly<ResolutionPolicyContext>;
  readonly resolved: ResolvedApp<Source>;
  readonly signal: AbortSignal;
}

export interface ServiceProviderResult<Services extends object> {
  readonly services: Readonly<Partial<Services>>;
  dispose?(): MaybePromise<void>;
}

export type ServiceProvider<Source, Services extends object> = (
  context: ServiceProviderContext<Source, Services>,
) => MaybePromise<ServiceProviderResult<Services>>;

export interface CreateServiceScopeOptions<
  Services extends object,
  Key extends ServiceKey<Services>,
> {
  readonly capabilities: readonly Key[];
  readonly identity: ApplicationIdentity;
  readonly policy?: CapabilityPolicy<Services>;
  readonly services: Services;
  readonly signal: AbortSignal;
  readonly dispose?: () => MaybePromise<void>;
}
