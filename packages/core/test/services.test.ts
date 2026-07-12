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
    expect(scope.services.navigation).toBe(services.navigation);
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

  it('revokes access to the service map after application teardown', async () => {
    const scope = await createServiceScope({
      capabilities: ['navigation'],
      identity,
      services,
      signal: new AbortController().signal,
    });

    scope.revoke();
    scope.revoke();
    expect(scope.revoked).toBe(true);
    expect(() => Object.keys(scope.services)).toThrow(TypeError);
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
});
