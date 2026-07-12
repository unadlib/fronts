import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type {
  ApplicationIdentity,
  FrontsHost,
  MountedApplication,
  ResolvedApp,
} from '@fronts/core';
import { normalizeAppRef } from '@fronts/core';
import { render, screen, waitFor } from '@testing-library/react';

import {
  RemoteApp,
  defineReactApp,
  useApplicationAbortSignal,
  useApplicationIdentity,
  useHostServices,
} from '../src/index.js';

interface Props {
  readonly value: string;
}

interface Services {
  readonly locale: { readonly language: string };
}

interface Source {
  readonly entry: string;
}

const identity: ApplicationIdentity = {
  instanceId: 'react-app-1',
  name: 'react-app',
  version: '2.0.0',
};

function ContextConsumer({ value }: Props) {
  const services = useHostServices<Services>();
  const appIdentity = useApplicationIdentity();
  const signal = useApplicationAbortSignal();
  return (
    <output data-aborted={String(signal.aborted)}>
      {appIdentity.name}:{services.locale.language}:{value}
    </output>
  );
}

describe('React application adapter', () => {
  beforeAll(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  });

  it('turns a React root into the framework-neutral Fronts lifecycle', async () => {
    const app = defineReactApp<Props, Services>({
      capabilities: ['locale'],
      root: ContextConsumer,
    });
    const target = document.createElement('div');
    const controller = new AbortController();
    let handle: Awaited<ReturnType<typeof app.mount>> | undefined;

    await act(async () => {
      handle = await app.mount({
        identity,
        props: { value: 'first' },
        services: { locale: { language: 'en-US' } },
        signal: controller.signal,
        target,
      });
    });
    if (handle === undefined) {
      throw new Error('React application did not return a handle.');
    }
    await handle.ready;
    expect(target.textContent).toBe('react-app:en-US:first');

    let update: PromiseLike<void> | void = undefined;
    act(() => {
      update = handle?.update?.({ value: 'second' });
    });
    await update;
    expect(target.textContent).toBe('react-app:en-US:second');

    act(() => {
      void handle?.unmount();
    });
    expect(target.textContent).toBe('');
  });

  it('supports custom provider/router composition without coupling core to a router', async () => {
    const app = defineReactApp<Props, Services>({
      render: ({ Root, props }) => (
        <section data-router="memory">
          <Root {...props} />
        </section>
      ),
      root: ContextConsumer,
    });
    const target = document.createElement('div');
    let handle: Awaited<ReturnType<typeof app.mount>> | undefined;
    await act(async () => {
      handle = await app.mount({
        identity,
        props: { value: 'routed' },
        services: { locale: { language: 'zh-CN' } },
        signal: new AbortController().signal,
        target,
      });
    });

    await handle?.ready;
    expect(target.querySelector('[data-router="memory"]')).not.toBeNull();
    act(() => void handle?.unmount());
  });

  it('rolls back the React root when initial render composition throws', () => {
    const failure = new Error('provider composition failed');
    const root = { render: vi.fn(), unmount: vi.fn() };
    const app = defineReactApp<Record<string, never>, object>({
      createRoot: () => root,
      render() {
        throw failure;
      },
      root: () => null,
    });

    expect(() =>
      app.mount({
        identity,
        props: {},
        services: {},
        signal: new AbortController().signal,
        target: document.createElement('div'),
      }),
    ).toThrow(failure);
    expect(root.render).not.toHaveBeenCalled();
    expect(root.unmount).toHaveBeenCalledOnce();
  });

  it('rejects readiness and renders an application fallback after React errors', async () => {
    const failure = new Error('render failed');
    const onError = vi.fn();
    const Broken = () => {
      throw failure;
    };
    const app = defineReactApp<Record<string, never>, object>({
      fallback: <p>Application unavailable</p>,
      onError,
      root: Broken,
    });
    const target = document.createElement('div');
    let handle: Awaited<ReturnType<typeof app.mount>> | undefined;
    let ready: Promise<void> | undefined;

    await act(async () => {
      handle = await app.mount({
        identity,
        props: {},
        services: {},
        signal: new AbortController().signal,
        target,
      });
      ready = Promise.resolve(handle.ready);
      void ready.catch(() => undefined);
    });

    await expect(ready).rejects.toBe(failure);
    expect(target.textContent).toBe('Application unavailable');
    expect(onError).toHaveBeenCalledOnce();
    act(() => void handle?.unmount());
  });

  it('keeps the render failure authoritative when the React error observer throws', async () => {
    const renderFailure = new Error('render failed');
    const observerFailure = new Error('error observer failed');
    const Broken = () => {
      throw renderFailure;
    };
    const onError = vi.fn(() => {
      throw observerFailure;
    });
    const app = defineReactApp<Record<string, never>, object>({
      fallback: <p>Application unavailable</p>,
      onError,
      root: Broken,
    });
    const target = document.createElement('div');
    let handle: Awaited<ReturnType<typeof app.mount>> | undefined;
    let ready: Promise<void> | undefined;

    await act(async () => {
      handle = await app.mount({
        identity,
        props: {},
        services: {},
        signal: new AbortController().signal,
        target,
      });
      ready = Promise.resolve(handle.ready);
      void ready.catch(() => undefined);
    });

    await expect(ready).rejects.toBe(renderFailure);
    expect(onError).toHaveBeenCalledOnce();
    expect(target.textContent).toBe('Application unavailable');
    act(() => void handle?.unmount());
  });

  it('recovers a failed update on the next render and remains unmountable', async () => {
    const failure = new Error('render failed');
    const Recoverable = ({ value }: Props) => {
      if (value === 'broken') {
        throw failure;
      }
      return <output>{value}</output>;
    };
    const app = defineReactApp<Props, object>({
      fallback: <p>Application unavailable</p>,
      root: Recoverable,
    });
    const target = document.createElement('div');
    let handle: Awaited<ReturnType<typeof app.mount>> | undefined;

    await act(async () => {
      handle = await app.mount({
        identity,
        props: { value: 'healthy' },
        services: {},
        signal: new AbortController().signal,
        target,
      });
    });
    await handle?.ready;

    let failedUpdate: PromiseLike<void> | void = undefined;
    await act(async () => {
      failedUpdate = handle?.update?.({ value: 'broken' });
      void Promise.resolve(failedUpdate).catch(() => undefined);
    });
    await expect(failedUpdate).rejects.toBe(failure);
    expect(target.textContent).toBe('Application unavailable');

    let recoveredUpdate: PromiseLike<void> | void = undefined;
    await act(async () => {
      recoveredUpdate = handle?.update?.({ value: 'recovered' });
    });
    await recoveredUpdate;
    expect(target.textContent).toBe('recovered');

    act(() => void handle?.unmount());
    expect(target.textContent).toBe('');
  });
});

describe('React host adapter', () => {
  it('mounts, updates and tears down remote applications without owning their DOM', async () => {
    const ref = normalizeAppRef({ name: 'checkout' });
    const resolved: ResolvedApp<Source> = {
      ref,
      source: { entry: 'checkout.json' },
    };
    const update = vi.fn(async () => undefined);
    const unmount = vi.fn(async () => undefined);
    const instance: MountedApplication<Props, Source> = {
      abort: vi.fn(async () => undefined),
      activate: vi.fn(async () => undefined),
      deactivate: vi.fn(async () => undefined),
      identity,
      ready: Promise.resolve(),
      ref,
      resolved,
      state: 'ready',
      unmount,
      update,
    };
    const mount = vi.fn(async () => instance);
    const host = { mount } as unknown as FrontsHost<Source, Services>;
    const onReady = vi.fn();

    const view = render(
      <RemoteApp
        app={{ name: 'checkout' }}
        appProps={{ value: 'first' }}
        host={host}
        loading={<p>Loading checkout</p>}
        onReady={onReady}
        traceId="trace-react-checkout"
      />,
    );

    expect(await screen.findByText('Loading checkout')).toBeTruthy();
    await waitFor(() => expect(onReady).toHaveBeenCalledWith(instance));
    expect(mount).toHaveBeenCalledWith(
      expect.objectContaining({
        props: { value: 'first' },
        ref: { name: 'checkout' },
        traceId: 'trace-react-checkout',
      }),
    );

    view.rerender(
      <RemoteApp
        app={{ name: 'checkout' }}
        appProps={{ value: 'second' }}
        host={host}
        traceId="trace-react-checkout"
      />,
    );
    await waitFor(() => expect(update).toHaveBeenCalledWith({ value: 'second' }));

    view.unmount();
    await waitFor(() => expect(unmount).toHaveBeenCalled());
  });

  it('renders host-level fallbacks when resolving or loading fails', async () => {
    const failure = new Error('registry unavailable');
    const host = {
      mount: vi.fn(async () => {
        throw failure;
      }),
    } as unknown as FrontsHost<Source, Services>;

    render(
      <RemoteApp
        app={{ name: 'checkout' }}
        appProps={{ value: 'first' }}
        fallback={(error) => <p>Failed: {error.message}</p>}
        host={host}
      />,
    );

    expect(await screen.findByText('Failed: registry unavailable')).toBeTruthy();
  });

  it('ignores late update failures from an instance replaced by remount', async () => {
    const ref = normalizeAppRef({ name: 'checkout' });
    const resolved: ResolvedApp<Source> = { ref, source: { entry: 'checkout.json' } };
    let rejectOldUpdate!: (reason: unknown) => void;
    const oldUpdate = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectOldUpdate = reject;
        }),
    );
    const createInstance = (
      instanceId: string,
      update: MountedApplication<Props, Source>['update'],
    ): MountedApplication<Props, Source> => ({
      abort: vi.fn(async () => undefined),
      activate: vi.fn(async () => undefined),
      deactivate: vi.fn(async () => undefined),
      identity: { ...identity, instanceId },
      ready: Promise.resolve(),
      ref,
      resolved,
      state: 'ready',
      unmount: vi.fn(async () => undefined),
      update,
    });
    const oldInstance = createInstance('react-old', oldUpdate);
    const newInstance = createInstance(
      'react-new',
      vi.fn(async () => undefined),
    );
    const host = {
      mount: vi.fn().mockResolvedValueOnce(oldInstance).mockResolvedValueOnce(newInstance),
    } as unknown as FrontsHost<Source, Services>;
    const view = render(
      <RemoteApp
        app={{ name: 'checkout' }}
        appProps={{ value: 'first' }}
        fallback={(failure) => <p>{failure.message}</p>}
        host={host}
        mountKey={1}
      />,
    );
    await waitFor(() => expect(host.mount).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(view.container.firstElementChild?.getAttribute('data-fronts-react-status')).toBe(
        'ready',
      ),
    );

    view.rerender(
      <RemoteApp
        app={{ name: 'checkout' }}
        appProps={{ value: 'second' }}
        fallback={(failure) => <p>{failure.message}</p>}
        host={host}
        mountKey={1}
      />,
    );
    await waitFor(() => expect(oldUpdate).toHaveBeenCalledOnce());
    view.rerender(
      <RemoteApp
        app={{ name: 'checkout' }}
        appProps={{ value: 'third' }}
        fallback={(failure) => <p>{failure.message}</p>}
        host={host}
        mountKey={2}
      />,
    );
    await waitFor(() => expect(host.mount).toHaveBeenCalledTimes(2));
    expect(oldUpdate).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(view.container.firstElementChild?.getAttribute('data-fronts-react-status')).toBe(
        'ready',
      ),
    );

    await act(async () => rejectOldUpdate(new Error('stale update failed')));
    expect(view.container.firstElementChild?.getAttribute('data-fronts-react-status')).toBe(
      'ready',
    );
    expect(screen.queryByText('stale update failed')).toBeNull();
  });

  it('waits for prior teardown before remounting the same host slot', async () => {
    const ref = normalizeAppRef({ name: 'checkout' });
    const resolved: ResolvedApp<Source> = { ref, source: { entry: 'checkout.json' } };
    let finishUnmount!: () => void;
    const firstUnmount = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishUnmount = resolve;
        }),
    );
    const createInstance = (
      instanceId: string,
      unmount: MountedApplication<Props, Source>['unmount'],
    ): MountedApplication<Props, Source> => ({
      abort: vi.fn(async () => undefined),
      activate: vi.fn(async () => undefined),
      deactivate: vi.fn(async () => undefined),
      identity: { ...identity, instanceId },
      ready: Promise.resolve(),
      ref,
      resolved,
      state: 'ready',
      unmount,
      update: vi.fn(async () => undefined),
    });
    const first = createInstance('shared-slot', firstUnmount);
    const second = createInstance(
      'shared-slot',
      vi.fn(async () => undefined),
    );
    const host = {
      mount: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second),
    } as unknown as FrontsHost<Source, Services>;
    const view = render(
      <RemoteApp
        app={{ name: 'checkout' }}
        appProps={{ value: 'first' }}
        host={host}
        instanceId="shared-slot"
        mountKey={1}
      />,
    );
    await waitFor(() => expect(host.mount).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(view.container.firstElementChild?.getAttribute('data-fronts-react-status')).toBe(
        'ready',
      ),
    );

    view.rerender(
      <RemoteApp
        app={{ name: 'checkout' }}
        appProps={{ value: 'second' }}
        host={host}
        instanceId="shared-slot"
        mountKey={2}
      />,
    );
    await waitFor(() => expect(firstUnmount).toHaveBeenCalledOnce());
    expect(host.mount).toHaveBeenCalledOnce();

    await act(async () => finishUnmount());
    await waitFor(() => expect(host.mount).toHaveBeenCalledTimes(2));
    view.unmount();
  });

  it('can be embedded under an existing React root', async () => {
    const element = document.createElement('div');
    const root = createRoot(element);
    await act(async () => {
      root.render(<p>Host remains framework-owned</p>);
    });
    expect(element.textContent).toBe('Host remains framework-owned');
    act(() => root.unmount());
  });
});
