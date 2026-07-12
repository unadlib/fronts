import { describe, expect, it, vi } from 'vitest';

import {
  createServiceScope,
  frontsErrorCodes,
  type ApplicationIdentity,
  type FrontsError,
} from '../src/index.js';

interface Services {
  readonly auth: { readonly user: string };
  readonly navigation: { go(path: string): void };
  readonly telemetry: { emit(name: string): void };
}

const identity: ApplicationIdentity = {
  instanceId: 'checkout-1',
  name: 'checkout',
};

const services: Services = {
  auth: { user: 'michael' },
  navigation: { go: vi.fn() },
  telemetry: { emit: vi.fn() },
};

describe('capability-scoped host services', () => {
  it('exposes only explicitly requested capabilities', async () => {
    const scope = await createServiceScope({
      capabilities: ['navigation', 'telemetry'],
      identity,
      services,
      signal: new AbortController().signal,
    });

    expect(Object.keys(scope.services)).toEqual(['navigation', 'telemetry']);
    expect(scope.services.navigation).not.toBe(services.navigation);
    scope.services.navigation.go('/checkout');
    expect(services.navigation.go).toHaveBeenCalledWith('/checkout');
    expect('auth' in scope.services).toBe(false);
    expect(scope.revoked).toBe(false);
  });

  it('applies asynchronous per-application authorization policies', async () => {
    const policy = vi.fn(async ({ capability }) => capability !== 'auth');

    await expect(
      createServiceScope({
        capabilities: ['auth'],
        identity,
        policy,
        services,
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.capabilityDenied,
      }),
    );
    expect(policy).toHaveBeenCalledOnce();
  });

  it('fails closed when a requested service is unavailable', async () => {
    await expect(
      createServiceScope({
        capabilities: ['missing'],
        identity,
        services: services as Services & { missing?: unknown },
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.capabilityDenied,
        details: { capability: 'missing', reason: 'unavailable' },
      }),
    );
  });

  it('revokes retained service and method references after application teardown', async () => {
    const scope = await createServiceScope({
      capabilities: ['navigation'],
      identity,
      services,
      signal: new AbortController().signal,
    });
    const retainedService = scope.services.navigation;
    const retainedMethod = scope.services.navigation.go;

    scope.revoke();
    scope.revoke();
    expect(scope.revoked).toBe(true);
    expect(() => Object.keys(scope.services)).toThrow(TypeError);
    expect(() => retainedService.go('/after-unmount')).toThrow(TypeError);
    expect(() => retainedMethod('/after-unmount')).toThrow(TypeError);
  });

  it('revokes capabilities immediately when the application lifetime is aborted', async () => {
    const controller = new AbortController();
    const scope = await createServiceScope({
      capabilities: ['navigation'],
      identity,
      services,
      signal: controller.signal,
    });
    const retainedMethod = scope.services.navigation.go;

    controller.abort('host teardown started');
    expect(scope.revoked).toBe(true);
    expect(() => retainedMethod('/after-abort')).toThrow(TypeError);
  });

  it('preserves service receiver identity and promise behavior while active', async () => {
    const receiver = {
      prefix: '/store',
      async go(this: { prefix: string }, path: string) {
        return `${this.prefix}${path}`;
      },
    };
    const scope = await createServiceScope({
      capabilities: ['navigation'],
      identity,
      services: { navigation: receiver },
      signal: new AbortController().signal,
    });

    await expect(scope.services.navigation.go('/cart')).resolves.toBe('/store/cart');
  });

  it('revokes nested and reflectively obtained capability values', async () => {
    const call = vi.fn();
    const scope = await createServiceScope({
      capabilities: ['workflow'],
      identity,
      services: { workflow: { nested: { call } } },
      signal: new AbortController().signal,
    });
    const retainedNested = scope.services.workflow.nested;
    const descriptor = Object.getOwnPropertyDescriptor(scope.services.workflow, 'nested');
    const reflected = descriptor?.value as { call(): void };

    retainedNested.call();
    reflected.call();
    expect(call).toHaveBeenCalledTimes(2);
    scope.revoke();
    expect(() => retainedNested.call()).toThrow(TypeError);
    expect(() => reflected.call()).toThrow(TypeError);
  });

  it('returns a fail-closed empty scope for applications declaring no capabilities', async () => {
    const scope = await createServiceScope({
      capabilities: [],
      identity,
      services,
      signal: new AbortController().signal,
    });

    expect(Object.keys(scope.services)).toEqual([]);
  });

  it('does not create an empty scope for an already aborted lifetime', async () => {
    const controller = new AbortController();
    controller.abort('cancelled');

    await expect(
      createServiceScope({
        capabilities: [],
        identity,
        services,
        signal: controller.signal,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: frontsErrorCodes.aborted, phase: 'mount' }));
  });
});
