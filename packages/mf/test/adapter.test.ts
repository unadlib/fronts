import {
  defineApp,
  frontsErrorCodes,
  normalizeAppRef,
  type DetachedHostOperationContext,
  type FrontsError,
} from '@fronts/core';
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

function createOperation(
  intent: DetachedHostOperationContext['intent'],
  signal = new AbortController().signal,
): DetachedHostOperationContext {
  return {
    hostId: 'mf-adapter-test-host',
    intent,
    operationId: `mf-adapter-test-${intent}`,
    signal,
    traceId: 'mf-adapter-test-trace',
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

    await expect(adapter.load(createResolved(source), createOperation('load'))).resolves.toEqual({
      default: app,
    });
    expect(runtime.registerRemotes).toHaveBeenCalledWith([source.remote], undefined);
    expect(runtime.registerRemotes.mock.calls[0]?.[0]?.[0]).not.toBe(source.remote);
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

    await adapter.load(createResolved(source), createOperation('load'));
    expect(runtime.registerRemotes).toHaveBeenCalledWith([source.remote], { force: true });
  });

  it('rejects silent reuse of a remote name for another resolved deployment', async () => {
    const runtime = createRuntime();
    runtime.loadRemote.mockResolvedValue({ module: true });
    const adapter = createModuleFederationAdapter({ instance: runtime.instance });
    const first = createModuleFederationSource({
      entry: 'https://cdn.example.test/checkout/2.0.0/remote.js',
      name: 'checkout',
    });
    const second = createModuleFederationSource({
      entry: 'https://cdn.example.test/checkout/3.0.0/remote.js',
      name: 'checkout',
    });

    await adapter.load(createResolved(first), createOperation('load'));
    await expect(
      adapter.load({ ...createResolved(second), version: '3.0.0' }, createOperation('load')),
    ).rejects.toMatchObject({
      code: frontsErrorCodes.loadFailed,
      details: {
        registeredVersion: '2.0.0',
        remote: 'checkout',
        requestedVersion: '3.0.0',
      },
      phase: 'load',
    });
    expect(runtime.registerRemotes).toHaveBeenCalledOnce();
    expect(runtime.loadRemote).toHaveBeenCalledOnce();
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

    await adapter.preload?.(createResolved(source), createOperation('preload'));
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
      'checkout/application',
    );
  });

  it('protects resolved sources from caller and runtime remote mutation', async () => {
    const runtime = createRuntime();
    runtime.loadRemote.mockResolvedValue({ module: true });
    runtime.registerRemotes.mockImplementation((remotes) => {
      const registered = remotes[0];
      if (registered !== undefined && 'entry' in registered) {
        registered.entry = 'https://runtime.example.test/normalized.js';
        registered.shareScope = 'runtime-default';
        registered.type = 'module';
      }
    });
    const inputRemote = {
      entry: './checkout.js',
      name: 'checkout',
    };
    const source = createModuleFederationSource(inputRemote);
    const adapter = createModuleFederationAdapter({ instance: runtime.instance });

    inputRemote.entry = './forged.js';
    await adapter.load(createResolved(source), createOperation('load'));

    expect(source.remote).toEqual({ entry: './checkout.js', name: 'checkout' });
    expect(Object.isFrozen(source)).toBe(true);
    expect(Object.isFrozen(source.remote)).toBe(true);
  });

  it('rejects malformed sources and null module results with stable Fronts errors', async () => {
    expect(() => assertModuleFederationSource({ remote: { name: 'checkout' } })).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.loadFailed }),
    );
    for (const [source, field] of [
      [{ remote: { entry: 42, name: 'checkout', version: '2.0.0' } }, 'remote.entry'],
      [{ remote: { entry: 'checkout.js', name: 'check out' } }, 'remote.name'],
      [{ remote: { alias: '', entry: 'checkout.js', name: 'checkout' } }, 'remote.alias'],
      [{ remote: { entry: 'checkout.js', name: 'checkout', shareScope: [] } }, 'remote.shareScope'],
      [{ remote: { entry: 'checkout.js', name: 'checkout', version: '2.0.0' } }, 'remote'],
      [{ force: 'yes', remote: { entry: 'checkout.js', name: 'checkout' } }, 'force'],
      [{ preload: [], remote: { entry: 'checkout.js', name: 'checkout' } }, 'preload'],
    ] as const) {
      expect(() => assertModuleFederationSource(source)).toThrowError(
        expect.objectContaining<Partial<FrontsError>>({
          code: frontsErrorCodes.loadFailed,
          details: { field },
          phase: 'load',
        }),
      );
    }

    const runtime = createRuntime();
    runtime.loadRemote.mockResolvedValue(null);
    const adapter = createModuleFederationAdapter({ instance: runtime.instance });
    const source = createModuleFederationSource({
      entry: 'https://cdn.example.test/checkout.js',
      name: 'checkout',
    });

    await expect(adapter.load(createResolved(source), createOperation('load'))).rejects.toEqual(
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
      adapter.load(createResolved(source), createOperation('load', controller.signal)),
    ).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.aborted }),
    );
    expect(runtime.registerRemotes).not.toHaveBeenCalled();
    expect(runtime.loadRemote).not.toHaveBeenCalled();
  });

  it('maps remote registration failures without attempting a load', async () => {
    const runtime = createRuntime();
    const registrationFailure = new Error('remote name collision');
    runtime.registerRemotes.mockImplementation(() => {
      throw registrationFailure;
    });
    const adapter = createModuleFederationAdapter({ instance: runtime.instance });
    const source = createModuleFederationSource({
      entry: 'https://cdn.example.test/checkout.js',
      name: 'checkout',
    });

    await expect(adapter.load(createResolved(source), createOperation('load'))).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({
        cause: registrationFailure,
        code: frontsErrorCodes.loadFailed,
        phase: 'load',
      }),
    );
    expect(runtime.loadRemote).not.toHaveBeenCalled();
  });

  it('does not continue loading when registration cancels the operation', async () => {
    const runtime = createRuntime();
    const controller = new AbortController();
    runtime.registerRemotes.mockImplementation(() => {
      controller.abort('registration policy cancelled');
    });
    const adapter = createModuleFederationAdapter({ instance: runtime.instance });
    const source = createModuleFederationSource({
      entry: 'https://cdn.example.test/checkout.js',
      name: 'checkout',
    });

    await expect(
      adapter.load(createResolved(source), createOperation('load', controller.signal)),
    ).rejects.toMatchObject({ code: frontsErrorCodes.aborted, phase: 'load' });
    expect(runtime.loadRemote).not.toHaveBeenCalled();
  });

  it('validates the expose before registering a remote', async () => {
    const runtime = createRuntime();
    const adapter = createModuleFederationAdapter({ instance: runtime.instance });
    const source = createModuleFederationSource({
      entry: 'https://cdn.example.test/checkout.js',
      name: 'checkout',
    });
    const resolved = {
      ...createResolved(source),
      ref: normalizeAppRef({ expose: './', name: 'checkout' }),
    };

    await expect(adapter.load(resolved, createOperation('load'))).rejects.toMatchObject({
      code: frontsErrorCodes.loadFailed,
      phase: 'load',
    });
    expect(runtime.registerRemotes).not.toHaveBeenCalled();
    expect(runtime.loadRemote).not.toHaveBeenCalled();
  });

  it('validates the expose before registering a remote for preload', async () => {
    const runtime = createRuntime();
    const adapter = createModuleFederationAdapter({ instance: runtime.instance });
    const source = createModuleFederationSource({
      entry: 'https://cdn.example.test/checkout.js',
      name: 'checkout',
    });
    const resolved = {
      ...createResolved(source),
      ref: normalizeAppRef({ expose: './', name: 'checkout' }),
    };

    await expect(adapter.preload?.(resolved, createOperation('preload'))).rejects.toMatchObject({
      code: frontsErrorCodes.loadFailed,
      phase: 'load',
    });
    expect(runtime.registerRemotes).not.toHaveBeenCalled();
    expect(runtime.preloadRemote).not.toHaveBeenCalled();
  });
});
