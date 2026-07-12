import { describe, expect, it, vi } from 'vitest';

import {
  createFrontsHost,
  defineApp,
  frontsErrorCodes,
  normalizeAppRef,
  type AppLoader,
  type AppResolver,
  type FrontsError,
  type HostEvent,
} from '../src/index.js';

interface Source {
  readonly entry: string;
}

interface Services {
  readonly navigation: { go(path: string): void };
  readonly telemetry: { emit(name: string): void };
}

interface Props {
  readonly value: string;
}

const services: Services = {
  navigation: { go: vi.fn() },
  telemetry: { emit: vi.fn() },
};

function createHarness(
  app = defineApp<Props, Services>({ mount: vi.fn(() => ({ unmount: vi.fn() })) }),
) {
  const resolved = {
    ref: normalizeAppRef({ name: 'checkout' }),
    source: { entry: 'https://example.test/mf-manifest.json' },
    version: '2.0.0',
  };
  const resolver = {
    resolve: vi.fn<AppResolver<Source>['resolve']>().mockResolvedValue(resolved),
  };
  const loader = {
    load: vi.fn<AppLoader<Source>['load']>().mockResolvedValue({ default: app }),
    preload: vi.fn<NonNullable<AppLoader<Source>['preload']>>().mockResolvedValue(undefined),
  };
  const events: HostEvent<Source>[] = [];
  const host = createFrontsHost({
    loader,
    observer: (event) => events.push(event),
    resolver,
    services,
  });

  return { app, events, host, loader, resolved, resolver };
}

describe('Fronts host runtime', () => {
  it('runs resolve, load, scope, container, mount, ready and teardown as one contract', async () => {
    const unmount = vi.fn();
    const mount = vi.fn(() => ({ ready: Promise.resolve(), unmount }));
    const app = defineApp<Props, Services>({
      capabilities: ['navigation'],
      mount,
    });
    const { events, host, loader, resolver } = createHarness(app);
    const target = document.createElement('main');

    const instance = await host.mount({
      instanceId: 'checkout-primary',
      props: { value: 'first' },
      ref: { name: 'checkout', range: '^2' },
      target,
    });

    expect(instance.state).toBe('ready');
    expect(instance.identity).toMatchObject({
      instanceId: 'checkout-primary',
      name: 'checkout',
      version: '2.0.0',
    });
    expect(resolver.resolve).toHaveBeenCalledOnce();
    expect(loader.load).toHaveBeenCalledOnce();
    expect(mount).toHaveBeenCalledWith(
      expect.objectContaining({
        props: { value: 'first' },
        services: { navigation: services.navigation },
        target: target.firstElementChild,
      }),
    );
    expect(host.get('checkout-primary')).toBe(instance);
    expect(host.inspect()[0]).toMatchObject({ containerType: 'dom', state: 'ready' });
    expect(
      events.filter((event) => event.kind === 'state').map((event) => event.snapshot.state),
    ).toEqual(['resolving', 'loading', 'preparing', 'mounting', 'ready']);

    await instance.unmount();
    await instance.unmount();
    expect(unmount).toHaveBeenCalledOnce();
    expect(target.children).toHaveLength(0);
    expect(instance.state).toBe('destroyed');
    expect(host.get('checkout-primary')).toBeUndefined();
  });

  it('serializes update, deactivate and activate lifecycle operations', async () => {
    const calls: string[] = [];
    const app = defineApp<Props, Services>({
      mount: () => ({
        activate: async () => void calls.push('activate'),
        deactivate: async () => void calls.push('deactivate'),
        unmount: async () => void calls.push('unmount'),
        update: async ({ value }) => void calls.push(`update:${value}`),
      }),
    });
    const { host } = createHarness(app);
    const instance = await host.mount({
      props: { value: 'initial' },
      ref: { name: 'checkout' },
      target: document.createElement('main'),
    });

    await Promise.all([
      instance.update({ value: 'next' }),
      instance.deactivate(),
      instance.activate(),
    ]);
    expect(calls).toEqual(['update:next', 'deactivate', 'activate']);
    expect(instance.state).toBe('active');
  });

  it('times out readiness and tears down every allocated resource', async () => {
    const unmount = vi.fn();
    const app = defineApp<Props, Services>({
      mount: () => ({ ready: new Promise<void>(() => undefined), unmount }),
    });
    const { host } = createHarness(app);
    const target = document.createElement('main');

    await expect(
      host.mount({
        props: { value: 'first' },
        readyTimeoutMs: 5,
        ref: { name: 'checkout' },
        target,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.readyTimeout,
        phase: 'ready',
      }),
    );
    expect(unmount).toHaveBeenCalledOnce();
    expect(target.children).toHaveLength(0);
    expect(host.inspect()[0]).toMatchObject({ state: 'failed' });
  });

  it('maps loader errors to the load phase without leaving a container behind', async () => {
    const { host, loader } = createHarness();
    loader.load.mockRejectedValueOnce(new Error('remote entry unavailable'));
    const target = document.createElement('main');

    await expect(
      host.mount({ props: { value: 'x' }, ref: { name: 'checkout' }, target }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.loadFailed,
        phase: 'load',
      }),
    );
    expect(target.children).toHaveLength(0);
    expect(host.inspect()[0]).toMatchObject({ state: 'failed' });
  });

  it('delegates preload without mounting the application', async () => {
    const { app, host, loader } = createHarness();
    const resolved = await host.preload({ name: 'checkout' });

    expect(resolved.version).toBe('2.0.0');
    expect(loader.preload).toHaveBeenCalledOnce();
    expect(loader.load).not.toHaveBeenCalled();
    expect(app.mount).not.toHaveBeenCalled();
  });

  it('automatically unmounts when the caller lifetime is aborted', async () => {
    const unmount = vi.fn();
    const app = defineApp<Props, Services>({ mount: () => ({ unmount }) });
    const { host } = createHarness(app);
    const controller = new AbortController();
    const instance = await host.mount({
      props: { value: 'x' },
      ref: { name: 'checkout' },
      signal: controller.signal,
      target: document.createElement('main'),
    });

    controller.abort('navigation');
    await vi.waitFor(() => expect(instance.state).toBe('destroyed'));
    expect(unmount).toHaveBeenCalledOnce();
  });

  it('rejects duplicate instance identities and operations after host disposal', async () => {
    const { host } = createHarness();
    await host.mount({
      instanceId: 'checkout',
      props: { value: 'x' },
      ref: { name: 'checkout' },
      target: document.createElement('main'),
    });

    await expect(
      host.mount({
        instanceId: 'checkout',
        props: { value: 'y' },
        ref: { name: 'checkout' },
        target: document.createElement('main'),
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.duplicateInstance,
      }),
    );

    await host.dispose();
    await host.dispose();
    await expect(host.resolve({ name: 'checkout' })).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.hostDisposed }),
    );
  });
});
