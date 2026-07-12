import type { ApplicationIdentity, MaybePromise, ServiceKey } from '../app/index.js';

export interface CapabilityPolicyContext<Services extends object> {
  readonly capability: ServiceKey<Services>;
  readonly identity: ApplicationIdentity;
  readonly service: Services[ServiceKey<Services>];
}

export type CapabilityPolicy<Services extends object> = (
  context: CapabilityPolicyContext<Services>,
) => MaybePromise<boolean>;

export interface ServiceScope<ScopedServices extends object> {
  readonly services: Readonly<ScopedServices>;
  readonly revoked: boolean;
  revoke(): void;
}

export interface CreateServiceScopeOptions<
  Services extends object,
  Key extends ServiceKey<Services>,
> {
  readonly capabilities: readonly Key[];
  readonly identity: ApplicationIdentity;
  readonly policy?: CapabilityPolicy<Services>;
  readonly services: Services;
  readonly signal: AbortSignal;
}
