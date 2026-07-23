import { createFrontsHost, defineApp, frontsErrorCodes, type HostComposition } from '@fronts/core';
import type * as FrontsCoreModule from '@fronts/core';
import { getInstance, type ModuleFederation } from '@module-federation/runtime';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { createMfHost, createModuleFederationSource } from '../src/index.js';

vi.mock('@fronts/core', async (importOriginal) => {
  const original = await importOriginal<typeof FrontsCoreModule>();
  return { ...original, createFrontsHost: vi.fn(original.createFrontsHost) };
});

interface ShopContracts {
  readonly account: { readonly accountId: string };
  readonly checkout: { readonly cartId: string };
}

interface HostServices {
  readonly telemetry: { emit(name: string): void };
}

function createRuntime() {
  const loadRemote = vi.fn();
  const preloadRemote = vi.fn(async () => undefined);
  const registerRemotes = vi.fn();
  return {
    instance: { loadRemote, preloadRemote, registerRemotes } as unknown as ModuleFederation,
    loadRemote,
    preloadRemote,
    registerRemotes,
  };
}

describe('Module Federation host shortcut', () => {
  it('validates Host options before creating an owned runtime', () => {
    const runtimeName = `invalid-host-${String(Date.now())}`;

    expect(() =>
      createMfHost<ShopContracts>({
        apps: {
          account: {
            entry: 'https://cdn.example.test/account/mf-manifest.json',
            remote: 'account',
          },
          checkout: {
            entry: 'https://cdn.example.test/checkout/mf-manifest.json',
            remote: 'checkout',
          },
        },
        hostId: '',
        name: 'invalid-host',
        runtimeName,
      }),
    ).toThrowError(expect.objectContaining({ code: frontsErrorCodes.mountFailed, phase: 'mount' }));
    expect(getInstance((instance) => instance.name === runtimeName)).toBeNull();
  });

  it('passes only core Host options across the composition boundary', async () => {
    const runtime = createRuntime();
    const composition = createMfHost<ShopContracts>({
      apps: {
        account: {
          entry: 'https://cdn.example.test/account/mf-manifest.json',
          remote: 'account',
        },
        checkout: {
          entry: 'https://cdn.example.test/checkout/mf-manifest.json',
          remote: 'checkout',
        },
      },
      name: 'projected-shell',
      readyTimeoutMs: 500,
      runtime: runtime.instance,
    });

    try {
      const forwarded = vi.mocked(createFrontsHost).mock.lastCall?.[0];

      expect(forwarded).toBeDefined();
      expect(Object.keys(forwarded ?? {}).sort()).toEqual([
        'hostId',
        'loader',
        'readyTimeoutMs',
        'resolver',
      ]);
      expect(forwarded?.hostId).toBe('projected-shell');
      expect(forwarded?.readyTimeoutMs).toBe(500);
    } finally {
      await composition.host.dispose();
    }
  });

  it('composes static deployments and preserves application reference defaults', async () => {
    const runtime = createRuntime();
    runtime.loadRemote.mockResolvedValue({
      default: defineApp<{ readonly cartId: string }>({
        mount: () => ({ unmount: () => undefined }),
      }),
    });
    const composition = createMfHost<ShopContracts, HostServices>({
      apps: {
        account: {
          entry: 'https://cdn.example.test/account/mf-manifest.json',
          remote: 'account_stable',
          version: '5.1.0',
        },
        checkout: [
          {
            entry: 'https://cdn.example.test/checkout/canary/mf-manifest.json',
            expose: './checkout-application',
            match: { channel: 'canary' },
            metadata: { release: 'canary' },
            remote: 'checkout_canary',
            version: '2.5.0',
          },
          {
            entry: 'https://cdn.example.test/checkout/stable/mf-manifest.json',
            expose: './checkout-application',
            remote: 'checkout_stable',
            version: '2.4.1',
          },
        ],
      },
      name: 'shop-shell',
      runtime: runtime.instance,
      services: { telemetry: { emit: vi.fn() } },
    });

    expect(composition.applications).toEqual({
      account: { expose: './application', name: 'account' },
      checkout: { expose: './checkout-application', name: 'checkout' },
    });
    expect(composition.host.id).toBe('shop-shell');
    expect(composition.runtime).toBe(runtime.instance);
    expectTypeOf(composition).toMatchTypeOf<
      HostComposition<ShopContracts, { readonly remote: object }, HostServices>
    >();

    try {
      const loaded = await composition.host.load<{ readonly cartId: string }>({
        ...composition.applications.checkout,
        channel: 'canary',
      });

      expect(loaded.resolved.version).toBe('2.5.0');
      expect(loaded.resolved.metadata).toEqual({ release: 'canary' });
      expect(Object.isFrozen(loaded.resolved.metadata)).toBe(true);
      expect(runtime.registerRemotes).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            entry: 'https://cdn.example.test/checkout/canary/mf-manifest.json',
            name: 'checkout_canary',
          }),
        ],
        undefined,
      );
      expect(runtime.loadRemote).toHaveBeenCalledWith('checkout_canary/checkout-application', {
        from: 'runtime',
      });
    } finally {
      await composition.host.dispose();
    }
  });

  it('pairs a custom resolver with an explicit application catalog', async () => {
    const runtime = createRuntime();
    runtime.preloadRemote.mockResolvedValue(undefined);
    const source = createModuleFederationSource({
      entry: 'https://cdn.example.test/checkout/mf-manifest.json',
      name: 'checkout_registry',
    });
    const resolver = {
      resolve: vi.fn((ref) => ({ ref, source, version: '3.0.0' })),
    };
    const composition = createMfHost<ShopContracts>({
      applications: {
        account: {},
        checkout: { expose: './checkout-registry-entry' },
      },
      name: 'registry-shell',
      resolver,
      runtime: runtime.instance,
    });

    try {
      await composition.host.preload(composition.applications.checkout, {
        environment: 'production',
      });

      expect(resolver.resolve).toHaveBeenCalledWith(
        { expose: './checkout-registry-entry', name: 'checkout' },
        expect.objectContaining({ environment: 'production' }),
      );
      expect(runtime.preloadRemote).toHaveBeenCalledWith([
        expect.objectContaining({
          exposes: ['./checkout-registry-entry'],
          nameOrAlias: 'checkout_registry',
        }),
      ]);
    } finally {
      await composition.host.dispose();
    }
  });

  it('rejects static candidates that disagree on their application expose', () => {
    const runtime = createRuntime();

    expect(() =>
      createMfHost<ShopContracts>({
        apps: {
          account: {
            entry: 'https://cdn.example.test/account/mf-manifest.json',
            remote: 'account',
          },
          checkout: [
            {
              entry: 'https://cdn.example.test/checkout/stable/mf-manifest.json',
              expose: './stable',
              remote: 'checkout_stable',
            },
            {
              entry: 'https://cdn.example.test/checkout/canary/mf-manifest.json',
              expose: './canary',
              remote: 'checkout_canary',
            },
          ],
        },
        name: 'invalid-shell',
        runtime: runtime.instance,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: frontsErrorCodes.resolutionFailed,
        phase: 'resolve',
      }),
    );
  });
});
