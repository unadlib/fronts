import { defineApp, frontsErrorCodes, normalizeAppRef, type FrontsError } from '@fronts/core';
import { describe, expect, it, vi } from 'vitest';

import {
  assertModuleFederationSource,
  createModuleFederationAdapter,
  createModuleFederationSource,
  toModuleFederationId,
  type ModuleFederationInstance,
  type ModuleFederationSource,
} from '../src/index.js';

function createRuntime() {
  const loadRemote = vi.fn();
  const preloadRemote = vi.fn();
  const registerRemotes = vi.fn();
  return {
    instance: {
      loadRemote,
      preloadRemote,
      registerRemotes,
    } as unknown as ModuleFederationInstance,
    loadRemote,
    preloadRemote,
    registerRemotes,
  };
}

function createResolved(source: ModuleFederationSource) {
  return {
    ref: normalizeAppRef({ expose: './application', name: 'checkout' }),
    source,
    version: '2.0.0',
  };
}

describe('Module Federation runtime adapter', () => {
  it('registers a manifest remote and loads the requested expose', async () => {
    const runtime = createRuntime();
    const app = defineApp({ mount: () => ({ unmount: vi.fn() }) });
    runtime.loadRemote.mockResolvedValue({ default: app });
    const source = createModuleFederationSource({
      entry: 'https://cdn.example.test/checkout/mf-manifest.json',
      name: 'checkout_2_0_0',
      type: 'module',
    });
    const adapter = createModuleFederationAdapter({ instance: runtime.instance });

    await expect(
      adapter.load(createResolved(source), { signal: new AbortController().signal }),
    ).resolves.toEqual({ default: app });
    expect(runtime.registerRemotes).toHaveBeenCalledWith([source.remote], undefined);
    expect(runtime.loadRemote).toHaveBeenCalledWith('checkout_2_0_0/application', {
      from: 'runtime',
    });
  });

  it('passes forced remote replacement through explicitly', async () => {
    const runtime = createRuntime();
    runtime.loadRemote.mockResolvedValue({ module: true });
    const source = createModuleFederationSource(
      { entry: 'https://cdn.example.test/checkout.js', name: 'checkout' },
      { force: true },
    );
    const adapter = createModuleFederationAdapter({ instance: runtime.instance });

    await adapter.load(createResolved(source), { signal: new AbortController().signal });
    expect(runtime.registerRemotes).toHaveBeenCalledWith([source.remote], { force: true });
  });

  it('preloads only the resolved expose with official runtime options', async () => {
    const runtime = createRuntime();
    runtime.preloadRemote.mockResolvedValue(undefined);
    const source = createModuleFederationSource(
      {
        alias: 'checkout-canary',
        entry: 'https://cdn.example.test/checkout/mf-manifest.json',
        name: 'checkout_2_1_0',
      },
      { preload: { resourceCategory: 'sync', share: false } },
    );
    const adapter = createModuleFederationAdapter({
      instance: runtime.instance,
      preload: { depsRemote: false, resourceCategory: 'all' },
    });

    await adapter.preload?.(createResolved(source), {
      signal: new AbortController().signal,
    });
    expect(runtime.preloadRemote).toHaveBeenCalledWith([
      {
        depsRemote: false,
        exposes: ['./application'],
        nameOrAlias: 'checkout-canary',
        resourceCategory: 'sync',
        share: false,
      },
    ]);
  });

  it('supports version-only remotes without implementing another registry', () => {
    const source = createModuleFederationSource({ name: 'checkout', version: '^2.0.0' });
    expect(source.remote).toEqual({ name: 'checkout', version: '^2.0.0' });
    expect(toModuleFederationId(source, normalizeAppRef({ name: 'checkout' }))).toBe(
      'checkout/app',
    );
  });

  it('rejects malformed sources and null module results with stable Fronts errors', async () => {
    expect(() => assertModuleFederationSource({ remote: { name: 'checkout' } })).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.loadFailed }),
    );

    const runtime = createRuntime();
    runtime.loadRemote.mockResolvedValue(null);
    const adapter = createModuleFederationAdapter({ instance: runtime.instance });
    const source = createModuleFederationSource({
      entry: 'https://cdn.example.test/checkout.js',
      name: 'checkout',
    });

    await expect(
      adapter.load(createResolved(source), { signal: new AbortController().signal }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.loadFailed }),
    );
  });

  it('honors cancellation before touching the global federation runtime', async () => {
    const runtime = createRuntime();
    const adapter = createModuleFederationAdapter({ instance: runtime.instance });
    const controller = new AbortController();
    controller.abort('navigation changed');
    const source = createModuleFederationSource({
      entry: 'https://cdn.example.test/checkout.js',
      name: 'checkout',
    });

    await expect(
      adapter.load(createResolved(source), { signal: controller.signal }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.aborted }),
    );
    expect(runtime.registerRemotes).not.toHaveBeenCalled();
    expect(runtime.loadRemote).not.toHaveBeenCalled();
  });
});
