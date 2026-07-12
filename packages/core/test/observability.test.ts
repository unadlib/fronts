import { describe, expect, it, vi } from 'vitest';

import {
  FrontsError,
  createFrontsHost,
  defineApp,
  frontsErrorCodes,
  type AppLoader,
  type AppResolver,
  type ContainerAdapter,
  type ContainerRequest,
  type HostEvent,
} from '../src/index.js';

interface Source {
  readonly entry: string;
}

interface LeakyContainerRequest extends ContainerRequest {
  readonly type: 'leaky';
}

function createRuntime(options: {
  readonly app?: ReturnType<typeof defineApp<Record<string, never>>>;
  readonly containers?: readonly ContainerAdapter[];
  readonly hostId?: string;
  readonly now?: () => number;
  readonly observer?: (event: HostEvent<Source>) => void;
  readonly resolver?: AppResolver<Source>;
}) {
  const app =
    options.app ??
    defineApp<Record<string, never>>({
      mount: () => ({ unmount: () => undefined }),
    });
  const resolver: AppResolver<Source> =
    options.resolver ??
    ({
      resolve: (ref) => ({ ref, source: { entry: 'checkout.js' }, version: '2.0.0' }),
    } satisfies AppResolver<Source>);
  const loader: AppLoader<Source> = {
    load: () => ({ default: app }),
  };
  return createFrontsHost({
    loader,
    resolver,
    ...(options.containers === undefined ? {} : { containers: options.containers }),
    ...(options.hostId === undefined ? {} : { hostId: options.hostId }),
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.observer === undefined ? {} : { observer: options.observer }),
  });
}

describe('host observability and runtime audits', () => {
  it('scopes each host subscription to its own unsubscribe function', async () => {
    const host = createRuntime({});
    const listener = vi.fn();
    const unsubscribeFirst = host.subscribe(listener);
    unsubscribeFirst();
    const unsubscribeSecond = host.subscribe(listener);
    unsubscribeFirst();

    const instance = await host.mount({
      props: {},
      ref: { name: 'checkout' },
      target: document.createElement('main'),
    });

    expect(listener).toHaveBeenCalled();
    const callsBeforeUnsubscribe = listener.mock.calls.length;
    unsubscribeSecond();
    await instance.unmount();
    expect(listener).toHaveBeenCalledTimes(callsBeforeUnsubscribe);
  });

  it('emits correlated, ordered state timings and error events', async () => {
    let time = 100;
    const events: HostEvent<Source>[] = [];
    const updateFailure = new Error('update failed');
    const app = defineApp<Record<string, never>>({
      mount: (context) => {
        expect(context.identity.traceId).toBe('trace-checkout-42');
        time = 123;
        return {
          unmount: () => undefined,
          update: () => {
            time = 126;
            throw updateFailure;
          },
        };
      },
    });
    const resolver: AppResolver<Source> = {
      resolve(ref) {
        time = 105;
        return { ref, source: { entry: 'checkout.js' }, version: '2.0.0' };
      },
    };
    const loader: AppLoader<Source> = {
      load() {
        time = 112;
        return { default: app };
      },
    };
    const host = createFrontsHost({
      hostId: 'shell-production',
      loader,
      now: () => time,
      observer: (event) => events.push(event),
      resolver,
    });
    const instance = await host.mount({
      instanceId: 'checkout-primary',
      props: {},
      ref: { name: 'checkout' },
      target: document.createElement('main'),
      traceId: 'trace-checkout-42',
    });

    const mountEvents = events.slice(0, 5);
    expect(host.id).toBe('shell-production');
    expect(mountEvents.map(({ sequence }) => sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(mountEvents.map(({ hostId }) => hostId)).toEqual(
      Array.from({ length: 5 }, () => 'shell-production'),
    );
    expect(mountEvents.map(({ snapshot }) => snapshot.identity.traceId)).toEqual(
      Array.from({ length: 5 }, () => 'trace-checkout-42'),
    );
    expect(mountEvents.map((event) => (event.kind === 'state' ? event.durationMs : -1))).toEqual([
      0, 5, 7, 0, 11,
    ]);

    await expect(instance.update({})).rejects.toMatchObject({
      code: frontsErrorCodes.lifecycleFailed,
      phase: 'update',
    });
    expect(events.map(({ sequence }) => sequence)).toEqual(
      events.map((_event, index) => index + 1),
    );
    expect(events.find((event) => event.kind === 'error')).toMatchObject({
      hostId: 'shell-production',
      phase: 'update',
      snapshot: { identity: { traceId: 'trace-checkout-42' } },
      timestamp: 126,
    });
    await instance.unmount();
  });

  it('reports unsupported application updates as lifecycle errors', async () => {
    const events: HostEvent<Source>[] = [];
    const host = createRuntime({ observer: (event) => events.push(event) });
    const instance = await host.mount({
      instanceId: 'static-checkout',
      props: {},
      ref: { name: 'checkout' },
      target: document.createElement('main'),
    });

    await expect(instance.update({})).rejects.toMatchObject({
      code: frontsErrorCodes.lifecycleFailed,
      phase: 'update',
    });
    expect(events.filter((event) => event.kind === 'error')).toEqual([
      expect.objectContaining({
        phase: 'update',
        snapshot: expect.objectContaining({
          identity: expect.objectContaining({ instanceId: 'static-checkout' }),
        }),
      }),
    ]);

    await instance.unmount();
  });

  it('attributes typed application failures to the active lifecycle phase', async () => {
    const events: HostEvent<Source>[] = [];
    const applicationError = new FrontsError(
      frontsErrorCodes.capabilityDenied,
      'navigation was denied',
      { details: { capability: 'navigation' }, phase: 'mount' },
    );
    const host = createRuntime({
      app: defineApp<Record<string, never>>({
        mount: () => ({
          unmount: () => undefined,
          update: () => {
            throw applicationError;
          },
        }),
      }),
      observer: (event) => events.push(event),
    });
    const instance = await host.mount({
      props: {},
      ref: { name: 'checkout' },
      target: document.createElement('main'),
    });

    await expect(instance.update({})).rejects.toMatchObject({
      cause: applicationError,
      code: frontsErrorCodes.capabilityDenied,
      details: { capability: 'navigation' },
      phase: 'update',
    });
    expect(events.findLast((event) => event.kind === 'error')).toMatchObject({
      error: { phase: 'update' },
      phase: 'update',
      snapshot: { error: { phase: 'update' } },
    });

    await instance.unmount();
  });

  it('reports live instances and becomes idle after complete teardown', async () => {
    const host = createRuntime({ hostId: 'shell-audit' });
    const instance = await host.mount({
      instanceId: 'checkout-live',
      props: {},
      ref: { name: 'checkout' },
      target: document.createElement('main'),
    });

    expect(host.audit()).toMatchObject({
      activeInstances: [{ identity: { instanceId: 'checkout-live' }, state: 'ready' }],
      cleanupFailures: [],
      hostId: 'shell-audit',
      idle: false,
      pendingOperations: 0,
      retainedContainers: [],
    });
    expect(() => host.assertIdle()).toThrowError(
      expect.objectContaining({ code: frontsErrorCodes.runtimeLeak }),
    );

    await instance.unmount();
    expect(host.audit()).toMatchObject({
      activeInstances: [],
      cleanupFailures: [],
      idle: true,
      pendingOperations: 0,
      retainedContainers: [],
    });
    expect(() => host.assertIdle()).not.toThrow();
  });

  it('does not let a failing observability clock block application cleanup', async () => {
    let clockReads = 0;
    const unmount = vi.fn();
    const host = createRuntime({
      app: defineApp<Record<string, never>>({
        mount: () => ({ unmount }),
      }),
      now: () => {
        clockReads += 1;
        if (clockReads > 5) {
          throw new Error('telemetry clock failed');
        }
        return clockReads;
      },
    });
    const instance = await host.mount({
      props: {},
      ref: { name: 'checkout' },
      target: document.createElement('main'),
    });

    await instance.unmount();

    expect(unmount).toHaveBeenCalledOnce();
    expect(instance.state).toBe('destroyed');
    expect(host.audit().idle).toBe(true);
  });

  it('detects an owned container that violates its dispose contract', async () => {
    const leakyContainer: ContainerAdapter<LeakyContainerRequest> = {
      type: 'leaky',
      prepare({ target }) {
        const element = target.ownerDocument.createElement('section');
        target.append(element);
        return {
          dispose: () => undefined,
          element,
          ownsElement: true,
          target: element,
          type: 'leaky',
        };
      },
    };
    const host = createRuntime({ containers: [leakyContainer], hostId: 'leak-test' });
    const target = document.createElement('main');
    const instance = await host.mount<Record<string, never>, LeakyContainerRequest>({
      container: { type: 'leaky' },
      instanceId: 'leaky-app',
      props: {},
      ref: { name: 'checkout' },
      target,
    });

    await instance.unmount();
    expect(host.audit()).toMatchObject({
      activeInstances: [],
      idle: false,
      retainedContainers: [
        {
          containerType: 'leaky',
          identity: { instanceId: 'leaky-app' },
          state: 'destroyed',
        },
      ],
    });
    expect(() => host.assertIdle()).toThrowError(
      expect.objectContaining({
        code: frontsErrorCodes.runtimeLeak,
        details: expect.objectContaining({ retainedContainers: ['leaky-app'] }),
      }),
    );

    target.replaceChildren();
    expect(host.audit().idle).toBe(true);
    expect(host.inspect()).toEqual([]);
  });

  it('shows pending mounts before they become application instances', async () => {
    let resolveReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const mounted = vi.fn();
    const host = createRuntime({
      app: defineApp<Record<string, never>>({
        mount: () => {
          mounted();
          return { ready, unmount: () => undefined };
        },
      }),
    });
    const pending = host.mount({
      props: {},
      ref: { name: 'checkout' },
      target: document.createElement('main'),
    });
    await vi.waitFor(() => expect(mounted).toHaveBeenCalledOnce());

    expect(host.audit()).toMatchObject({
      activeInstances: [],
      idle: false,
      pendingOperations: 1,
    });
    resolveReady();
    const instance = await pending;
    await instance.unmount();
    expect(host.audit().idle).toBe(true);
  });
});
