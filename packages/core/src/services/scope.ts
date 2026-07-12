import { FrontsError, frontsErrorCodes, throwIfAborted } from '../errors.js';
import type { ServiceKey } from '../app/index.js';
import type { CreateServiceScopeOptions, ServiceScope } from './types.js';

export async function createServiceScope<Services extends object, Key extends ServiceKey<Services>>(
  options: CreateServiceScopeOptions<Services, Key>,
): Promise<ServiceScope<Pick<Services, Key>>> {
  const scoped = Object.create(null) as Pick<Services, Key>;

  for (const capability of new Set(options.capabilities)) {
    throwIfAborted(options.signal, 'mount');
    if (!(capability in options.services)) {
      throw new FrontsError(
        frontsErrorCodes.capabilityDenied,
        `Application "${options.identity.name}" requested unavailable capability "${capability}".`,
        {
          details: { capability, reason: 'unavailable' },
          phase: 'mount',
        },
      );
    }

    const service = options.services[capability];
    const allowed =
      options.policy === undefined ||
      (await options.policy({ capability, identity: options.identity, service }));
    throwIfAborted(options.signal, 'mount');

    if (!allowed) {
      throw new FrontsError(
        frontsErrorCodes.capabilityDenied,
        `Application "${options.identity.name}" was denied capability "${capability}".`,
        {
          details: { capability, reason: 'policy' },
          phase: 'mount',
        },
      );
    }

    Object.defineProperty(scoped, capability, {
      enumerable: true,
      value: service,
      writable: false,
    });
  }

  Object.freeze(scoped);
  const revocable = Proxy.revocable(scoped, {});
  let revoked = false;

  return {
    get revoked() {
      return revoked;
    },
    revoke() {
      if (!revoked) {
        revoked = true;
        revocable.revoke();
      }
    },
    services: revocable.proxy,
  };
}
