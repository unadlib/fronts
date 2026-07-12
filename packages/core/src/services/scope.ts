import { FrontsError, frontsErrorCodes, stringifyUnknown, throwIfAborted } from '../errors.js';
import type { ServiceKey } from '../app/index.js';
import { raceWithAbort } from '../host/utils.js';
import type { CreateServiceScopeOptions, ServiceScope } from './types.js';

interface RevocableMembrane {
  revoke(): void;
  wrap<Value>(value: Value): Value;
}

function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function createRevocableMembrane(): RevocableMembrane {
  const originals = new WeakMap<object, object>();
  const proxies = new WeakMap<object, object>();
  const revoke = new Set<() => void>();
  let revoked = false;

  const assertActive = (): void => {
    if (revoked) {
      throw new TypeError('Cannot access a revoked Fronts capability.');
    }
  };

  const unwrap = <Value>(value: Value): Value =>
    (isObjectLike(value) ? (originals.get(value) as Value | undefined) : undefined) ?? value;

  const wrap = <Value>(value: Value): Value => {
    if (!isObjectLike(value)) {
      return value;
    }

    const existing = proxies.get(value);
    if (existing !== undefined) {
      return existing as Value;
    }

    const callable = typeof value === 'function';
    const target = callable
      ? function frontsCapabilityFacade() {}.bind(undefined)
      : Object.create(null);
    const handler: ProxyHandler<object> = {
      defineProperty() {
        assertActive();
        return false;
      },
      deleteProperty() {
        assertActive();
        return false;
      },
      get(_target, property) {
        assertActive();
        return wrap(Reflect.get(value, property, value));
      },
      getPrototypeOf() {
        assertActive();
        return Reflect.getPrototypeOf(value);
      },
      has(_target, property) {
        assertActive();
        return Reflect.has(value, property);
      },
      isExtensible() {
        assertActive();
        return true;
      },
      preventExtensions() {
        assertActive();
        return false;
      },
      set() {
        assertActive();
        return false;
      },
      setPrototypeOf() {
        assertActive();
        return false;
      },
      ...(callable
        ? {
            apply(_target: object, thisArgument: unknown, argumentsList: unknown[]) {
              assertActive();
              return wrap(
                Reflect.apply(
                  value as (...arguments_: unknown[]) => unknown,
                  unwrap(thisArgument),
                  argumentsList.map(unwrap),
                ),
              );
            },
            construct(_target: object, argumentsList: unknown[], newTarget) {
              assertActive();
              const constructor = value as new (...arguments_: unknown[]) => object;
              const unwrappedTarget = unwrap(newTarget) as new (...arguments_: unknown[]) => object;
              return wrap(
                Reflect.construct(constructor, argumentsList.map(unwrap), unwrappedTarget),
              );
            },
          }
        : {
            getOwnPropertyDescriptor(
              _target: object,
              property: PropertyKey,
            ): PropertyDescriptor | undefined {
              assertActive();
              const descriptor = Reflect.getOwnPropertyDescriptor(value, property);
              if (descriptor === undefined) {
                return undefined;
              }
              if ('value' in descriptor) {
                return {
                  configurable: true,
                  enumerable: descriptor.enumerable ?? false,
                  value: wrap(descriptor.value),
                  writable: false,
                };
              }
              return {
                configurable: true,
                enumerable: descriptor.enumerable ?? false,
                ...(descriptor.get === undefined ? {} : { get: wrap(descriptor.get) }),
              };
            },
            ownKeys() {
              assertActive();
              return Reflect.ownKeys(value);
            },
          }),
    };
    const revocable = Proxy.revocable(target, handler);
    proxies.set(value, revocable.proxy);
    originals.set(revocable.proxy, value);
    revoke.add(revocable.revoke);
    return revocable.proxy as Value;
  };

  return {
    revoke() {
      if (revoked) {
        return;
      }
      revoked = true;
      for (const revokeProxy of revoke) {
        revokeProxy();
      }
      revoke.clear();
    },
    wrap,
  };
}

export async function createServiceScope<Services extends object, Key extends ServiceKey<Services>>(
  options: CreateServiceScopeOptions<Services, Key>,
): Promise<ServiceScope<Pick<Services, Key>>> {
  const scoped = Object.create(null) as Pick<Services, Key>;
  const membrane = createRevocableMembrane();

  try {
    throwIfAborted(options.signal, 'mount');
    for (const capability of new Set(options.capabilities)) {
      throwIfAborted(options.signal, 'mount');
      if (
        typeof capability !== 'string' ||
        capability.length === 0 ||
        ['__proto__', 'constructor', 'prototype'].includes(capability)
      ) {
        const description = stringifyUnknown(capability);
        throw new FrontsError(
          frontsErrorCodes.capabilityDenied,
          `Application "${options.identity.name}" requested invalid capability "${description}".`,
          {
            details: { capability: description, reason: 'invalid' },
            phase: 'mount',
          },
        );
      }
      if (!Object.prototype.hasOwnProperty.call(options.services, capability)) {
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
        (await raceWithAbort(
          options.policy(
            Object.freeze({
              capability,
              identity: options.identity,
              service,
              signal: options.signal,
            }),
          ),
          options.signal,
          'mount',
        ));
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
        value: membrane.wrap(service),
        writable: false,
      });
    }

    Object.freeze(scoped);
    const revocable = Proxy.revocable(scoped, {});
    let revoked = false;
    let disposePromise: Promise<void> | undefined;
    let unlinkAbort: () => void = () => undefined;

    const revokeScope = (): void => {
      if (revoked) {
        return;
      }
      revoked = true;
      unlinkAbort();
      revocable.revoke();
      membrane.revoke();
    };
    const onAbort = () => revokeScope();
    options.signal.addEventListener('abort', onAbort, { once: true });
    unlinkAbort = () => options.signal.removeEventListener('abort', onAbort);

    return {
      dispose() {
        revokeScope();
        disposePromise ??= (async () => {
          await options.dispose?.();
        })();
        return disposePromise;
      },
      get revoked() {
        return revoked;
      },
      revoke: revokeScope,
      services: revocable.proxy,
    };
  } catch (error) {
    membrane.revoke();
    try {
      await options.dispose?.();
    } catch {
      // The authorization or cancellation failure remains authoritative.
    }
    throw error;
  }
}
