import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  createContainerRegistry,
  createDomContainer,
  createFrontsHost,
  defineApp,
  frontsErrorCodes,
  normalizeAppRef,
  type AppLoader,
  type AppResolver,
  type ContainerAdapter,
  type ContainerPrepareContext,
  type ContainerRequestResolver,
  type ContainerRequest,
  type DomContainerRequest,
  type FrontsError,
  type FrontsPhase,
  type HostEvent,
  type ServiceProviderContext,
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

interface AbortableContainerRequest extends ContainerRequest {
  readonly type: 'abortable';
}

interface DeploymentContainerRequest extends ContainerRequest {
  readonly marker: string;
  readonly type: 'deployment';
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
    resolve: vi
      .fn<AppResolver<Source>['resolve']>()
      .mockImplementation((ref) => ({ ...resolved, ref })),
  };
  const loader = {
    load: vi.fn<AppLoader<Source>['load']>().mockResolvedValue({ default: app }),
    preload: vi.fn<NonNullable<AppLoader<Source>['preload']>>().mockResolvedValue(undefined),
  };
  const domContainer = createDomContainer<Source>();
  const containerPrepare = vi.fn(domContainer.prepare);
  const events: HostEvent<Source>[] = [];
  const host = createFrontsHost({
    containers: [{ ...domContainer, prepare: containerPrepare }],
    hostId: 'host-test',
    loader,
    observer: (event) => events.push(event),
    resolver,
    services,
  });

  return { app, containerPrepare, events, host, loader, resolved, resolver };
}

describe('Fronts host runtime', () => {
  it('runs resolve, load, scope, container, mount, ready and teardown as one contract', async () => {
    const unmount = vi.fn();
    const mount = vi.fn(() => ({ ready: Promise.resolve(), unmount }));
    const app = defineApp<Props, Services>({
      capabilities: ['navigation'],
      mount,
    });
    const { containerPrepare, events, host, loader, resolver } = createHarness(app);
    const target = document.createElement('main');

    const instance = await host.mount({
      instanceId: 'checkout-primary',
      operationId: 'checkout-mount',
      props: { value: 'first' },
      ref: { name: 'checkout', range: '^2' },
      target,
      traceId: 'checkout-trace',
    });

    expect(instance.state).toBe('ready');
    expect(instance.identity).toMatchObject({
      instanceId: 'checkout-primary',
      name: 'checkout',
      version: '2.0.0',
    });
    expect(resolver.resolve).toHaveBeenCalledOnce();
    expect(loader.load).toHaveBeenCalledOnce();
    expect(resolver.resolve.mock.calls[0]?.[1].operation).toMatchObject({
      hostId: 'host-test',
      identity: { instanceId: 'checkout-primary', name: 'checkout' },
      intent: 'mount',
      operationId: 'checkout-mount',
      traceId: 'checkout-trace',
    });
    expect(loader.load.mock.calls[0]?.[1]).toMatchObject({
      hostId: 'host-test',
      identity: { instanceId: 'checkout-primary', name: 'checkout', version: '2.0.0' },
      intent: 'mount',
      operationId: 'checkout-mount',
      traceId: 'checkout-trace',
    });
    expect(containerPrepare.mock.calls[0]?.[0].operation).toMatchObject({
      hostId: 'host-test',
      identity: { instanceId: 'checkout-primary', name: 'checkout', version: '2.0.0' },
      intent: 'mount',
      operationId: 'checkout-mount',
      traceId: 'checkout-trace',
    });
    expect(containerPrepare.mock.calls[0]?.[0].resolved).toBe(instance.resolved);
    expect(mount).toHaveBeenCalledWith(
      expect.objectContaining({
        props: { value: 'first' },
        services: { navigation: expect.any(Object) },
        target: target.firstElementChild,
      }),
    );
    expect(host.get('checkout-primary')).toBe(instance);
    expect(host.inspect()[0]).toMatchObject({
      containerType: 'dom',
      intent: 'mount',
      operationId: 'checkout-mount',
      state: 'ready',
    });
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

  it('plans containers from the resolved deployment before selecting a loader', async () => {
    const unmount = vi.fn();
    const app = defineApp<Props, Services>({ mount: () => ({ unmount }) });
    const defaultLoad = vi.fn<AppLoader<Source>['load']>();
    const deploymentLoad = vi.fn<AppLoader<Source>['load']>().mockResolvedValue({ default: app });
    const plannedRequest: DeploymentContainerRequest = {
      marker: 'frame-from-registry',
      type: 'deployment',
    };
    const planner = vi.fn<ContainerRequestResolver<Source, DeploymentContainerRequest>>(
      async (context) => {
        expect(Object.isFrozen(context)).toBe(true);
        expect(Object.isFrozen(context.resolved)).toBe(true);
        expect(context).toMatchObject({
          identity: { name: 'checkout', version: '2.0.0' },
          operation: { intent: 'mount' },
          resolution: { tenant: 'acme' },
          resolved: { source: { entry: 'https://example.test/mf-manifest.json' } },
        });
        return plannedRequest;
      },
    );
    const prepare = vi.fn<ContainerAdapter<DeploymentContainerRequest, Source>['prepare']>(
      ({ request, resolved, target }) => {
        expect(request).not.toBe(plannedRequest);
        expect(Object.isFrozen(request)).toBe(true);
        expect(request.marker).toBe('frame-from-registry');
        expect(resolved.source.entry).toBe('https://example.test/mf-manifest.json');
        const element = target.ownerDocument.createElement('section');
        target.append(element);
        return {
          dispose: () => element.remove(),
          element,
          ownsElement: true,
          target: element,
          type: 'deployment',
        };
      },
    );
    const host = createFrontsHost<Source, Services>({
      containerLoaders: { deployment: { load: deploymentLoad } },
      containers: [
        {
          prepare(context) {
            expectTypeOf(context.resolved.source).toEqualTypeOf<Source>();
            return prepare(context as ContainerPrepareContext<DeploymentContainerRequest, Source>);
          },
          type: 'deployment',
        },
      ],
      loader: { load: defaultLoad },
      resolver: {
        resolve: (ref) => ({
          ref,
          source: { entry: 'https://example.test/mf-manifest.json' },
          version: '2.0.0',
        }),
      },
      services,
    });
    const target = document.createElement('main');

    const instance = await host.mount({
      container: planner,
      props: { value: 'planned' },
      ref: { name: 'checkout' },
      resolve: { tenant: 'acme' },
      target,
    });

    expect(planner).toHaveBeenCalledOnce();
    expect(defaultLoad).not.toHaveBeenCalled();
    expect(deploymentLoad).toHaveBeenCalledOnce();
    expect(prepare).toHaveBeenCalledOnce();
    expect(host.inspect()[0]).toMatchObject({ containerType: 'deployment' });
    await instance.unmount();
    expect(unmount).toHaveBeenCalledOnce();
    expect(target.children).toHaveLength(0);
  });

  it('keeps host source inference with a source-agnostic container registry', async () => {
    const containers = createContainerRegistry();
    const { loader, resolver } = createHarness();
    const host = createFrontsHost({ containers, loader, resolver, services });

    const instance = await host.mount({
      props: { value: 'typed' },
      ref: { name: 'checkout' },
      target: document.createElement('main'),
    });

    expectTypeOf(instance.resolved.source).toEqualTypeOf<Source>();
    await instance.unmount();
    expect(host.audit().idle).toBe(true);
  });

  it('cancels asynchronous container planning before loading an application', async () => {
    let finishPlanning!: (request: DomContainerRequest) => void;
    const planned = new Promise<DomContainerRequest>((resolve) => {
      finishPlanning = resolve;
    });
    const planner = vi.fn<ContainerRequestResolver<Source, DomContainerRequest>>(() => planned);
    const { host, loader, resolver } = createHarness();
    const controller = new AbortController();
    const pending = host.mount({
      container: planner,
      props: { value: 'cancelled' },
      ref: { name: 'checkout' },
      signal: controller.signal,
      target: document.createElement('main'),
    });
    await vi.waitFor(() => expect(planner).toHaveBeenCalledOnce());

    controller.abort('deployment changed');
    await expect(pending).rejects.toMatchObject({
      code: frontsErrorCodes.aborted,
      phase: 'container',
    });
    expect(resolver.resolve).toHaveBeenCalledOnce();
    expect(loader.load).not.toHaveBeenCalled();
    expect(host.audit().idle).toBe(true);

    finishPlanning({ type: 'dom' });
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
    const { events, host } = createHarness(app);
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
    expect(host.inspect()).toEqual([]);
    expect(events.at(-2)).toMatchObject({ kind: 'state', snapshot: { state: 'failed' } });
  });

  it('rejects invalid readiness timeouts even when an app has no ready promise', async () => {
    const { app, host, loader, resolver } = createHarness();

    await expect(
      host.mount({
        props: { value: 'first' },
        readyTimeoutMs: Number.POSITIVE_INFINITY,
        ref: { name: 'checkout' },
        target: document.createElement('main'),
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.readyTimeout,
        phase: 'ready',
      }),
    );
    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(loader.load).not.toHaveBeenCalled();
    expect(app.mount).not.toHaveBeenCalled();
  });

  it('rejects an invalid host readiness timeout during construction', () => {
    const { loader, resolver } = createHarness();

    expect(() =>
      createFrontsHost({
        loader,
        readyTimeoutMs: -1,
        resolver,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.readyTimeout,
        phase: 'ready',
      }),
    );
  });

  it.each([null, {}, { type: '' }, { type: ' padded ' }, Object.create({ type: 'dom' })])(
    'rejects the invalid container request %j before starting a transaction',
    async (container) => {
      const { app, host, loader, resolver } = createHarness();

      await expect(
        host.mount({
          container: container as unknown as ContainerRequest,
          props: { value: 'first' },
          ref: { name: 'checkout' },
          target: document.createElement('main'),
        }),
      ).rejects.toMatchObject({
        code: frontsErrorCodes.containerFailed,
        phase: 'container',
      });
      expect(resolver.resolve).not.toHaveBeenCalled();
      expect(loader.load).not.toHaveBeenCalled();
      expect(app.mount).not.toHaveBeenCalled();
      expect(host.audit().idle).toBe(true);
    },
  );

  it.each([
    [{ environment: 42 }, 'environment'],
    [{ tenant: null }, 'tenant'],
    [{ cohort: {} }, 'cohort'],
    [{ metadata: [] }, 'metadata'],
  ] as const)('rejects invalid resolution policy field $field', async (resolve, field) => {
    const { host, resolver } = createHarness();

    await expect(
      host.mount({
        props: { value: 'invalid-policy' },
        ref: { name: 'checkout' },
        resolve: resolve as never,
        target: document.createElement('main'),
      }),
    ).rejects.toMatchObject({
      code: frontsErrorCodes.resolutionFailed,
      details: { property: field },
      phase: 'resolve',
    });
    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(host.audit().idle).toBe(true);
  });

  it('maps loader errors to the load phase without leaving a container behind', async () => {
    const { events, host, loader } = createHarness();
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
    expect(host.inspect()).toEqual([]);
    expect(events.at(-2)).toMatchObject({ kind: 'state', snapshot: { state: 'failed' } });
  });

  it('reports capability authorization failures in the mount phase', async () => {
    const app = defineApp<Props, Services>({
      capabilities: ['navigation'],
      mount: vi.fn(() => ({ unmount: vi.fn() })),
    });
    const { loader, resolver } = createHarness(app);
    const events: HostEvent<Source>[] = [];
    const disposeServices = vi.fn(async () => undefined);
    const host = createFrontsHost({
      capabilityPolicy: () => false,
      createServices: () => ({ dispose: disposeServices, services: {} }),
      loader,
      observer: (event) => events.push(event),
      resolver,
      services,
    });

    await expect(
      host.mount({
        props: { value: 'x' },
        ref: { name: 'checkout' },
        target: document.createElement('main'),
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.capabilityDenied,
        phase: 'mount',
      }),
    );
    expect(events.find((event) => event.kind === 'error')).toMatchObject({
      phase: 'mount',
      snapshot: { state: 'failed' },
    });
    expect(disposeServices).toHaveBeenCalledOnce();
  });

  it('rejects invalid capability declarations before invoking the service provider', async () => {
    const app = defineApp<Props, Services>({
      capabilities: ['__proto__'] as unknown as readonly (keyof Services & string)[],
      mount: vi.fn(() => ({ unmount: vi.fn() })),
    });
    const { loader, resolver } = createHarness(app);
    const createServices = vi.fn(() => ({ services: {} }));
    const host = createFrontsHost({ createServices, loader, resolver, services });

    await expect(
      host.mount({
        props: { value: 'x' },
        ref: { name: 'checkout' },
        target: document.createElement('main'),
      }),
    ).rejects.toMatchObject({
      code: frontsErrorCodes.capabilityDenied,
      details: { capability: '__proto__', reason: 'invalid' },
    });
    expect(createServices).not.toHaveBeenCalled();
    expect(app.mount).not.toHaveBeenCalled();
  });

  it('preserves capability errors for unprintable declarations', async () => {
    const app = defineApp<Props, Services>({
      capabilities: [Object.create(null)] as unknown as readonly (keyof Services & string)[],
      mount: vi.fn(() => ({ unmount: vi.fn() })),
    });
    const { host } = createHarness(app);

    await expect(
      host.mount({
        props: { value: 'x' },
        ref: { name: 'checkout' },
        target: document.createElement('main'),
      }),
    ).rejects.toMatchObject({
      code: frontsErrorCodes.capabilityDenied,
      details: { capability: '[unprintable value]', reason: 'invalid' },
      phase: 'mount',
    });
    expect(app.mount).not.toHaveBeenCalled();
  });

  it('creates identity-bound services per instance and disposes each scope independently', async () => {
    const serviceFacades: Services['telemetry'][] = [];
    const serviceCalls: string[] = [];
    const disposers = new Map<string, ReturnType<typeof vi.fn>>();
    const providerContexts: ServiceProviderContext<Source, Services>[] = [];
    const app = defineApp<Props, Services>({
      capabilities: ['navigation', 'telemetry'],
      mount({ identity, services }) {
        serviceFacades.push(services.telemetry);
        services.navigation.go(`/${identity.instanceId}`);
        services.telemetry.emit('mounted');
        return { unmount: vi.fn() };
      },
    });
    const { loader, resolver } = createHarness(app);
    const staticNavigation: Services['navigation'] = { go: vi.fn() };
    const staticTelemetry: Services['telemetry'] = { emit: vi.fn() };
    const host = createFrontsHost<Source, Services>({
      createServices(context) {
        providerContexts.push(context);
        const dispose = vi.fn(async () => undefined);
        disposers.set(context.identity.instanceId, dispose);
        return {
          dispose,
          services: {
            telemetry: {
              emit: (name) => {
                serviceCalls.push(`${context.identity.instanceId}:${name}`);
              },
            },
          },
        };
      },
      hostId: 'contextual-services-host',
      loader,
      resolver,
      services: {
        navigation: staticNavigation,
        telemetry: staticTelemetry,
      },
    });

    const first = await host.mount({
      instanceId: 'checkout-a',
      operationId: 'mount-a',
      props: { value: 'a' },
      ref: { name: 'checkout' },
      resolve: { tenant: 'acme' },
      target: document.createElement('main'),
      traceId: 'trace-a',
    });
    const second = await host.mount({
      instanceId: 'checkout-b',
      operationId: 'mount-b',
      props: { value: 'b' },
      ref: { name: 'checkout' },
      target: document.createElement('main'),
      traceId: 'trace-b',
    });

    expect(serviceCalls).toEqual(['checkout-a:mounted', 'checkout-b:mounted']);
    expect(staticTelemetry.emit).not.toHaveBeenCalled();
    expect(serviceFacades[0]).not.toBe(serviceFacades[1]);
    expect(providerContexts[0]).toMatchObject({
      capabilities: ['navigation', 'telemetry'],
      hostId: 'contextual-services-host',
      identity: { instanceId: 'checkout-a', traceId: 'trace-a', version: '2.0.0' },
      operation: { intent: 'mount', operationId: 'mount-a', traceId: 'trace-a' },
      resolution: { tenant: 'acme' },
      resolved: { version: '2.0.0' },
    });
    expect(providerContexts[0]?.identity).toBe(providerContexts[0]?.operation.identity);
    expect(providerContexts[0]?.signal).toBe(providerContexts[0]?.operation.signal);
    expect(Object.isFrozen(providerContexts[0]?.capabilities)).toBe(true);
    expect(Object.isFrozen(providerContexts[0]?.resolution)).toBe(true);
    expect(staticNavigation.go).toHaveBeenCalledWith('/checkout-a');
    expect(staticNavigation.go).toHaveBeenCalledWith('/checkout-b');
    await first.unmount();
    expect(disposers.get('checkout-a')).toHaveBeenCalledOnce();
    expect(disposers.get('checkout-b')).not.toHaveBeenCalled();
    await second.unmount();
    expect(disposers.get('checkout-b')).toHaveBeenCalledOnce();
  });

  it('surfaces service disposal failures while still releasing the application container', async () => {
    const disposalFailure = new Error('telemetry channel cleanup failed');
    const app = defineApp<Props, Services>({
      capabilities: ['telemetry'],
      mount: () => ({ unmount: vi.fn() }),
    });
    const { loader, resolver } = createHarness(app);
    const target = document.createElement('main');
    const host = createFrontsHost({
      createServices: () => ({
        dispose: () => {
          throw disposalFailure;
        },
        services: { telemetry: { emit: vi.fn() } },
      }),
      loader,
      resolver,
      services,
    });
    const instance = await host.mount({
      props: { value: 'x' },
      ref: { name: 'checkout' },
      target,
    });

    await expect(instance.unmount()).rejects.toMatchObject({
      code: frontsErrorCodes.lifecycleFailed,
      phase: 'unmount',
    });
    expect(instance.state).toBe('failed');
    expect(target.children).toHaveLength(0);
    expect(host.get(instance.identity.instanceId)).toBeUndefined();
    expect(host.inspect()).toEqual([
      expect.objectContaining({
        cleanupError: expect.objectContaining({ code: frontsErrorCodes.lifecycleFailed }),
        state: 'failed',
      }),
    ]);
    expect(host.audit()).toMatchObject({
      cleanupFailures: [
        { cleanupError: { code: frontsErrorCodes.lifecycleFailed }, state: 'failed' },
      ],
      idle: false,
    });
    expect(() => host.assertIdle()).toThrowError(
      expect.objectContaining({
        code: frontsErrorCodes.runtimeLeak,
        details: expect.objectContaining({
          cleanupFailures: [instance.identity.instanceId],
        }),
      }),
    );
    await expect(host.dispose()).rejects.toMatchObject({ code: frontsErrorCodes.runtimeLeak });
  });

  it('keeps a mount failure primary while reporting rollback cleanup failures', async () => {
    const app = defineApp<Props, Services>({
      mount: () => ({
        ready: Promise.reject(new Error('render failed')),
        unmount: () => {
          throw new Error('framework root cleanup failed');
        },
      }),
    });
    const { events, host } = createHarness(app);

    await expect(
      host.mount({
        instanceId: 'checkout-rollback-failure',
        props: { value: 'x' },
        ref: { name: 'checkout' },
        target: document.createElement('main'),
      }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.mountFailed, phase: 'ready' });

    expect(host.inspect()[0]).toMatchObject({
      cleanupError: { code: frontsErrorCodes.lifecycleFailed, phase: 'unmount' },
      error: { code: frontsErrorCodes.mountFailed, phase: 'ready' },
      state: 'failed',
    });
    expect(events.filter((event) => event.kind === 'error').map((event) => event.phase)).toEqual([
      'ready',
      'unmount',
    ]);
  });

  it('reports provider rollback failure without replacing its validation error', async () => {
    const rollbackFailure = new Error('invalid provider result could not be disposed');
    const { events, loader, resolver } = createHarness();
    const host = createFrontsHost<Source, Services>({
      createServices: () => ({
        dispose: () => {
          throw rollbackFailure;
        },
        services: null as unknown as Services,
      }),
      loader,
      observer: (event) => events.push(event),
      resolver,
      services,
    });

    await expect(
      host.mount({
        instanceId: 'invalid-provider-result',
        props: { value: 'x' },
        ref: { name: 'checkout' },
        target: document.createElement('main'),
      }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.mountFailed, phase: 'mount' });

    expect(host.inspect()[0]).toMatchObject({
      cleanupError: { code: frontsErrorCodes.lifecycleFailed, phase: 'unmount' },
      error: { code: frontsErrorCodes.mountFailed, phase: 'mount' },
      state: 'failed',
    });
    expect(events.filter((event) => event.kind === 'error').map((event) => event.phase)).toEqual([
      'mount',
      'unmount',
    ]);
    await expect(host.dispose()).rejects.toMatchObject({ code: frontsErrorCodes.runtimeLeak });
  });

  it('delegates preload without mounting the application', async () => {
    const { app, host, loader, resolver } = createHarness();
    const resolved = await host.preload(
      { name: 'checkout' },
      { operationId: 'checkout-preload', traceId: 'navigation-trace' },
    );

    expect(resolved.version).toBe('2.0.0');
    expect(loader.preload).toHaveBeenCalledOnce();
    expect(resolver.resolve.mock.calls.at(-1)?.[1].operation).toMatchObject({
      intent: 'preload',
      operationId: 'checkout-preload',
      traceId: 'navigation-trace',
    });
    expect(loader.preload.mock.calls[0]?.[1]).toMatchObject({
      intent: 'preload',
      operationId: 'checkout-preload',
      traceId: 'navigation-trace',
    });
    expect(loader.load).not.toHaveBeenCalled();
    expect(app.mount).not.toHaveBeenCalled();
  });

  it('correlates direct loads without inventing an application identity', async () => {
    const { app, host, loader, resolver } = createHarness();

    const loaded = await host.load(
      { name: 'checkout' },
      { operationId: 'checkout-load', traceId: 'request-trace' },
    );

    expect(loaded.app).toBe(app);
    expect(resolver.resolve.mock.calls[0]?.[1].operation).toMatchObject({
      hostId: 'host-test',
      intent: 'load',
      operationId: 'checkout-load',
      traceId: 'request-trace',
    });
    expect(resolver.resolve.mock.calls[0]?.[1].operation).not.toHaveProperty('identity');
    expect(loader.load.mock.calls[0]?.[1]).toMatchObject({
      hostId: 'host-test',
      intent: 'load',
      operationId: 'checkout-load',
      traceId: 'request-trace',
    });
    expect(loader.load.mock.calls[0]?.[1]).not.toHaveProperty('identity');
    expect(app.mount).not.toHaveBeenCalled();
  });

  it('snapshots and freezes trusted host envelopes across extension boundaries', async () => {
    const ref = { name: 'checkout' };
    const metadata = { rollout: 'stable' };
    const resolveOptions = {
      environment: 'production',
      metadata,
      operationId: 'trusted-operation',
      traceId: 'trusted-trace',
    };
    const resolvedMetadata = { deploymentId: 'checkout-v2' };
    const resolved = {
      ref: normalizeAppRef(ref),
      source: { entry: 'checkout.js' },
      metadata: resolvedMetadata,
      version: '2.0.0',
    };
    const resolver: AppResolver<Source> = {
      resolve: vi.fn((normalized, resolveContext) => {
        expect(Object.isFrozen(normalized)).toBe(true);
        expect(Object.isFrozen(resolveContext)).toBe(true);
        expect(Object.isFrozen(resolveContext.operation)).toBe(true);
        expect(Reflect.set(normalized, 'name', 'forged')).toBe(false);
        expect(Reflect.set(resolveContext.operation, 'hostId', 'forged')).toBe(false);
        return resolved;
      }),
    };
    const unmount = vi.fn();
    const app = defineApp<Props, Services>({
      mount: vi.fn((mountContext) => {
        expect(Object.isFrozen(mountContext)).toBe(true);
        expect(Object.isFrozen(mountContext.identity)).toBe(true);
        expect(mountContext.identity.instanceId).toBe('trusted-instance');
        return { unmount };
      }),
    });
    const loader: AppLoader<Source> = {
      load: vi.fn((deployment, loadContext) => {
        expect(Object.isFrozen(deployment)).toBe(true);
        expect(Object.isFrozen(deployment.metadata)).toBe(true);
        expect(Object.isFrozen(loadContext)).toBe(true);
        expect(Object.isFrozen(loadContext.identity)).toBe(true);
        expect(Reflect.set(deployment, 'version', 'forged')).toBe(false);
        expect(Reflect.set(loadContext.identity, 'instanceId', 'forged')).toBe(false);
        return { default: app };
      }),
    };
    const host = createFrontsHost({ loader, resolver, services });

    const directResolution = host.resolve(ref, resolveOptions);
    resolveOptions.operationId = 'forged-operation';
    metadata.rollout = 'forged';
    await directResolution;
    expect(resolver.resolve).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        environment: 'production',
        metadata: { rollout: 'stable' },
        operation: expect.objectContaining({
          operationId: 'trusted-operation',
          traceId: 'trusted-trace',
        }),
      }),
    );

    const instance = await host.mount({
      instanceId: 'trusted-instance',
      props: { value: 'trusted' },
      ref,
      target: document.createElement('main'),
    });
    resolvedMetadata.deploymentId = 'forged-after-resolution';

    expect(instance.identity).toMatchObject({
      instanceId: 'trusted-instance',
      name: 'checkout',
      version: '2.0.0',
    });
    expect(instance.resolved.metadata).toEqual({ deploymentId: 'checkout-v2' });
    await instance.unmount();
    expect(host.audit().idle).toBe(true);
  });

  it('snapshots mount inputs before asynchronous resolution', async () => {
    let finishResolution!: () => void;
    const resolutionGate = new Promise<void>((resolve) => {
      finishResolution = resolve;
    });
    const originalTarget = document.createElement('main');
    const app = defineApp<Props, Services>({
      mount: vi.fn(({ props, target }) => {
        expect(props).toEqual({ value: 'original' });
        expect(target).toBe(originalTarget.firstElementChild);
        return { unmount: vi.fn() };
      }),
    });
    const { loader, resolved } = createHarness(app);
    const resolver: AppResolver<Source> = {
      async resolve() {
        await resolutionGate;
        return resolved;
      },
    };
    const host = createFrontsHost({ loader, resolver, services });
    const forgedTarget = document.createElement('main');
    const attributes = { 'data-policy': 'original' };
    const container = { attributes, type: 'dom' as const };
    const mountOptions = {
      container,
      props: { value: 'original' },
      readyTimeoutMs: 100,
      ref: { name: 'checkout' },
      target: originalTarget,
    };

    const mounting = host.mount(mountOptions);
    mountOptions.props = { value: 'forged' };
    mountOptions.target = forgedTarget;
    mountOptions.readyTimeoutMs = Number.POSITIVE_INFINITY;
    Reflect.set(container, 'type', 'shadow');
    attributes['data-policy'] = 'forged';
    finishResolution();

    const instance = await mounting;
    expect(originalTarget.firstElementChild?.getAttribute('data-policy')).toBe('original');
    expect(forgedTarget.children).toHaveLength(0);
    expect(instance.state).toBe('ready');
    await instance.unmount();
  });

  it('audits and aborts detached resolve, load and preload operations during disposal', async () => {
    const { host, resolver } = createHarness();
    const signals: AbortSignal[] = [];
    resolver.resolve.mockImplementation((_ref, context) => {
      signals.push(context.signal);
      return new Promise(() => undefined);
    });

    const operations = [
      host.resolve({ name: 'checkout' }),
      host.load({ name: 'checkout' }),
      host.preload({ name: 'checkout' }),
    ];
    await vi.waitFor(() => expect(signals).toHaveLength(3));
    expect(host.audit()).toMatchObject({ idle: false, pendingOperations: 3 });
    const failures = operations.map(async (operation) => {
      await expect(operation).rejects.toMatchObject({ code: frontsErrorCodes.aborted });
    });

    await host.dispose();
    await Promise.all(failures);

    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(host.audit()).toMatchObject({ idle: true, pendingOperations: 0 });
  });

  it('reports invalid detached operation identifiers in the matching operation phase', async () => {
    const { host, resolver } = createHarness();

    await expect(host.resolve({ name: 'checkout' }, { operationId: ' ' })).rejects.toMatchObject({
      code: frontsErrorCodes.resolutionFailed,
      phase: 'resolve',
    });
    await expect(host.load({ name: 'checkout' }, { traceId: '\t' })).rejects.toMatchObject({
      code: frontsErrorCodes.loadFailed,
      phase: 'load',
    });
    await expect(host.preload({ name: 'checkout' }, { operationId: '\n' })).rejects.toMatchObject({
      code: frontsErrorCodes.loadFailed,
      phase: 'load',
    });

    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(host.audit()).toMatchObject({ idle: true, pendingOperations: 0 });
  });

  it('validates explicit and generated mount identifiers before resolving', async () => {
    const { host, loader, resolver } = createHarness();
    const target = document.createElement('main');
    const controller = new AbortController();
    const subscribe = vi.spyOn(controller.signal, 'addEventListener');

    await expect(
      host.mount({
        instanceId: ' ',
        props: { value: 'invalid' },
        ref: { name: 'checkout' },
        target,
      }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.mountFailed, phase: 'mount' });
    await expect(
      host.mount({
        operationId: '\n',
        props: { value: 'invalid operation id' },
        ref: { name: 'checkout' },
        target,
      }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.mountFailed, phase: 'mount' });
    await expect(
      host.mount({
        props: { value: 'invalid trace id' },
        ref: { name: 'checkout' },
        signal: controller.signal,
        target,
        traceId: '\t',
      }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.mountFailed, phase: 'mount' });

    const generatedIdHost = createFrontsHost({
      createInstanceId: () => '\t',
      loader,
      resolver,
      services,
    });
    await expect(
      generatedIdHost.mount({
        props: { value: 'invalid generated id' },
        ref: { name: 'checkout' },
        target,
      }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.mountFailed, phase: 'mount' });

    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(target.children).toHaveLength(0);
    expect(host.inspect()).toEqual([]);
    expect(generatedIdHost.inspect()).toEqual([]);
  });

  it('selects an isolated loader for a configured container type', async () => {
    const harness = createHarness();
    const { loader: defaultLoader, resolved, resolver } = harness;
    const isolatedApp = defineApp<Props, Services>({ mount: () => ({ unmount: vi.fn() }) });
    const isolatedLoader = {
      load: vi.fn<AppLoader<Source>['load']>().mockResolvedValue({ default: isolatedApp }),
    };
    const host = createFrontsHost({
      containerLoaders: { shadow: isolatedLoader },
      loader: defaultLoader,
      resolver,
      services,
    });

    const instance = await host.mount({
      container: { type: 'shadow' },
      props: { value: 'isolated' },
      ref: resolved.ref,
      target: document.createElement('main'),
    });

    expect(isolatedLoader.load).toHaveBeenCalledOnce();
    expect(defaultLoader.load).not.toHaveBeenCalled();
    expect(instance.state).toBe('ready');
  });

  it('ignores inherited loader properties for custom container types', async () => {
    const { loader, resolver } = createHarness();
    const container: ContainerAdapter = {
      type: 'toString',
      prepare({ target }) {
        const element = document.createElement('section');
        target.append(element);
        return {
          dispose: () => element.remove(),
          element,
          ownsElement: true,
          target: element,
          type: 'toString',
        };
      },
    };
    const host = createFrontsHost({ containers: [container], loader, resolver, services });

    const instance = await host.mount({
      container: { type: 'toString' },
      props: { value: 'custom' },
      ref: { name: 'checkout' },
      target: document.createElement('main'),
    });

    expect(loader.load).toHaveBeenCalledOnce();
    expect(instance.state).toBe('ready');
    await instance.unmount();
    expect(host.audit().idle).toBe(true);
  });

  it('automatically unmounts when the caller lifetime is aborted', async () => {
    const unmount = vi.fn();
    const app = defineApp<Props, Services>({ mount: () => ({ unmount }) });
    const { loader, resolver } = createHarness(app);
    const disposeServices = vi.fn(async () => undefined);
    const host = createFrontsHost({
      createServices: () => ({ dispose: disposeServices, services: {} }),
      loader,
      resolver,
      services,
    });
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
    expect(disposeServices).toHaveBeenCalledOnce();
  });

  it('cleans a container whose ownership arrives after cancellation', async () => {
    const controller = new AbortController();
    const dispose = vi.fn();
    const target = document.createElement('main');
    const adapter: ContainerAdapter<AbortableContainerRequest> = {
      type: 'abortable',
      prepare({ target: parent }) {
        const element = parent.ownerDocument.createElement('section');
        parent.append(element);
        controller.abort('cancelled during container preparation');
        return {
          dispose: () => {
            dispose();
            element.remove();
          },
          element,
          ownsElement: true,
          target: element,
          type: 'abortable',
        };
      },
    };
    const { loader, resolver } = createHarness();
    const host = createFrontsHost({ containers: [adapter], loader, resolver, services });

    await expect(
      host.mount<Props, AbortableContainerRequest>({
        container: { type: 'abortable' },
        props: { value: 'x' },
        ref: { name: 'checkout' },
        signal: controller.signal,
        target,
      }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.aborted, phase: 'container' });

    await vi.waitFor(() => expect(dispose).toHaveBeenCalledOnce());
    expect(target.children).toHaveLength(0);
    expect(host.audit()).toMatchObject({ idle: true, pendingOperations: 0 });
  });

  it('audits a late owned container that violates its disposal contract', async () => {
    const controller = new AbortController();
    const target = document.createElement('main');
    const adapter: ContainerAdapter<AbortableContainerRequest> = {
      type: 'abortable',
      prepare({ target: parent }) {
        const element = parent.ownerDocument.createElement('section');
        parent.append(element);
        controller.abort('cancelled during leaky container preparation');
        return {
          dispose: () => undefined,
          element,
          ownsElement: true,
          target: element,
          type: 'abortable',
        };
      },
    };
    const { loader, resolver } = createHarness();
    const host = createFrontsHost({ containers: [adapter], loader, resolver, services });

    await expect(
      host.mount<Props, AbortableContainerRequest>({
        container: { type: 'abortable' },
        instanceId: 'late-leaky-container',
        props: { value: 'x' },
        ref: { name: 'checkout' },
        signal: controller.signal,
        target,
      }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.aborted, phase: 'container' });

    await vi.waitFor(() => expect(host.audit().pendingOperations).toBe(0));
    expect(host.audit()).toMatchObject({
      idle: false,
      retainedContainers: [
        {
          identity: { instanceId: 'late-leaky-container' },
          state: 'aborted',
        },
      ],
    });
    target.replaceChildren();
    expect(host.audit().idle).toBe(true);
    expect(host.inspect()).toEqual([]);
  });

  it('unmounts an application handle that resolves after cancellation', async () => {
    let resolveHandle!: (handle: { unmount(): void }) => void;
    const unmount = vi.fn();
    const mount = vi.fn(
      () =>
        new Promise<{ unmount(): void }>((resolve) => {
          resolveHandle = resolve;
        }),
    );
    const app = defineApp<Props, Services>({ mount });
    const { loader, resolver } = createHarness(app);
    const events: HostEvent<Source>[] = [];
    const host = createFrontsHost({
      loader,
      observer: (event) => events.push(event),
      resolver,
      services,
    });
    const controller = new AbortController();
    const pending = host.mount({
      props: { value: 'x' },
      ref: { name: 'checkout' },
      signal: controller.signal,
      target: document.createElement('main'),
    });
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce());

    controller.abort('navigation changed');
    await expect(pending).rejects.toMatchObject({ code: frontsErrorCodes.aborted, phase: 'mount' });
    expect(events.slice(-2)).toEqual([
      expect.objectContaining({
        kind: 'state',
        phase: 'mount',
        snapshot: expect.objectContaining({ state: 'aborted' }),
      }),
      expect.objectContaining({
        error: expect.objectContaining({ phase: 'mount' }),
        kind: 'error',
        phase: 'mount',
      }),
    ]);
    expect(host.audit()).toMatchObject({ idle: false, pendingOperations: 1 });

    resolveHandle({ unmount });
    await vi.waitFor(() => expect(unmount).toHaveBeenCalledOnce());
    expect(host.audit()).toMatchObject({ idle: true, pendingOperations: 0 });
  });

  it('releases terminal instance identities for remount and clean retry', async () => {
    const { host, loader } = createHarness();
    const target = document.createElement('main');
    const first = await host.mount({
      instanceId: 'checkout-stable',
      props: { value: 'first' },
      ref: { name: 'checkout' },
      target,
    });
    await first.unmount();

    const second = await host.mount({
      instanceId: 'checkout-stable',
      props: { value: 'second' },
      ref: { name: 'checkout' },
      target,
    });
    await second.unmount();
    expect(host.inspect()).toEqual([]);

    loader.load.mockRejectedValueOnce(new Error('temporary federation failure'));
    await expect(
      host.mount({
        instanceId: 'checkout-retry',
        props: { value: 'failed' },
        ref: { name: 'checkout' },
        target,
      }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.loadFailed });
    const retried = await host.mount({
      instanceId: 'checkout-retry',
      props: { value: 'retried' },
      ref: { name: 'checkout' },
      target,
    });
    await retried.unmount();
    expect(host.inspect()).toEqual([]);
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
    const disposedOperations: readonly (readonly [() => unknown, FrontsPhase])[] = [
      [() => host.resolve({ name: 'checkout' }), 'resolve'],
      [() => host.load({ name: 'checkout' }), 'load'],
      [() => host.preload({ name: 'checkout' }), 'load'],
      [
        () =>
          host.mount({
            props: { value: 'disposed' },
            ref: { name: 'checkout' },
            target: document.createElement('main'),
          }),
        'mount',
      ],
      [
        () =>
          host.replace('checkout', {
            props: { value: 'disposed' },
            ref: { name: 'checkout' },
            target: document.createElement('main'),
          }),
        'mount',
      ],
    ];
    for (const [operation, phase] of disposedOperations) {
      await expect(Promise.resolve().then(() => operation())).rejects.toMatchObject({
        code: frontsErrorCodes.hostDisposed,
        phase,
      });
    }
  });
});
