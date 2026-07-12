import { flushPromises, mount as mountVue } from '@vue/test-utils';
import {
  defineComponent,
  h,
  inject,
  nextTick,
  type App,
  type ComponentPublicInstance,
  type createApp,
} from 'vue';
import { describe, expect, it, vi } from 'vitest';

import type {
  ApplicationIdentity,
  FrontsHost,
  MountedApplication,
  ResolvedApp,
} from '@fronts/core';
import { normalizeAppRef } from '@fronts/core';

import {
  RemoteApp,
  defineVueApp,
  useApplicationAbortSignal,
  useApplicationIdentity,
  useHostServices,
  useRemoteApp,
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
  instanceId: 'vue-app-1',
  name: 'vue-app',
  version: '2.0.0',
};

const ContextConsumer = defineComponent({
  name: 'ContextConsumer',
  props: {
    value: { type: String, required: true },
  },
  setup(props) {
    const services = useHostServices<Services>();
    const appIdentity = useApplicationIdentity();
    const signal = useApplicationAbortSignal();
    return () =>
      h(
        'output',
        { 'data-aborted': String(signal.aborted) },
        `${appIdentity.name}:${services.locale.language}:${props.value}`,
      );
  },
});

describe('Vue application adapter', () => {
  it('turns a Vue root into the framework-neutral Fronts lifecycle', async () => {
    const app = defineVueApp<Props, Services>({
      capabilities: ['locale'],
      root: ContextConsumer,
    });
    const target = document.createElement('div');
    const handle = await app.mount({
      identity,
      props: { value: 'first' },
      services: { locale: { language: 'en-US' } },
      signal: new AbortController().signal,
      target,
    });

    await handle.ready;
    expect(target.textContent).toBe('vue-app:en-US:first');

    await handle.update?.({ value: 'second' });
    expect(target.textContent).toBe('vue-app:en-US:second');

    await handle.unmount();
    expect(target.textContent).toBe('');
  });

  it('supports router and plugin composition through the configure hook', async () => {
    const routeKey = Symbol('route');
    const Root = defineComponent({
      setup: () => {
        const route = inject(routeKey);
        return () => h('span', String(route));
      },
    });
    const configure = vi.fn((vueApp) => {
      vueApp.provide(routeKey, '/checkout');
    });
    const app = defineVueApp<Props, Services>({ configure, root: Root });
    const target = document.createElement('div');
    const handle = await app.mount({
      identity,
      props: { value: 'unused' },
      services: { locale: { language: 'zh-CN' } },
      signal: new AbortController().signal,
      target,
    });

    await handle.ready;
    expect(configure).toHaveBeenCalledOnce();
    expect(target.textContent).toBe('/checkout');
    await handle.unmount();
  });

  it('removes an owned Shadow wrapper when configuration fails', async () => {
    const failure = new Error('router configuration failed');
    const target = document.createElement('div').attachShadow({ mode: 'open' });
    const app = defineVueApp<Props, Services>({
      configure: async () => {
        throw failure;
      },
      root: ContextConsumer,
    });

    await expect(
      app.mount({
        identity,
        props: { value: 'failed' },
        services: { locale: { language: 'en-US' } },
        signal: new AbortController().signal,
        target,
      }),
    ).rejects.toBe(failure);
    expect(target.childElementCount).toBe(0);
  });

  it('preserves the external target when Vue mounting throws', async () => {
    const failure = new Error('Vue mount failed');
    const parent = document.createElement('main');
    const target = document.createElement('div');
    parent.append(target);
    const unmount = vi.fn();
    const vueApp = {
      config: {},
      mount() {
        target.append(document.createElement('span'));
        throw failure;
      },
      provide: vi.fn(),
      unmount,
    } as unknown as App;
    const app = defineVueApp<Props, Services>({
      createApp: (() => vueApp) as typeof createApp,
      root: ContextConsumer,
    });

    await expect(
      app.mount({
        identity,
        props: { value: 'failed' },
        services: { locale: { language: 'en-US' } },
        signal: new AbortController().signal,
        target,
      }),
    ).rejects.toBe(failure);
    expect(unmount).toHaveBeenCalledOnce();
    expect(parent.firstElementChild).toBe(target);
    expect(target.children).toHaveLength(0);
  });

  it('owns and removes an inner mount element for Shadow DOM targets', async () => {
    const target = document.createElement('div').attachShadow({ mode: 'open' });
    const app = defineVueApp<Props, Services>({ root: ContextConsumer });
    const handle = await app.mount({
      identity,
      props: { value: 'shadow' },
      services: { locale: { language: 'en-US' } },
      signal: new AbortController().signal,
      target,
    });

    await handle.ready;
    expect(target.textContent).toBe('vue-app:en-US:shadow');
    expect(target.childElementCount).toBe(1);
    await handle.unmount();
    expect(target.childElementCount).toBe(0);
  });

  it('rejects readiness after Vue reports an application render error', async () => {
    const failure = new Error('render failed');
    const onError = vi.fn();
    const Broken = defineComponent({
      setup: () => () => {
        throw failure;
      },
    });
    const app = defineVueApp<Record<string, never>, object>({
      onError,
      root: Broken,
    });
    const target = document.createElement('div');
    const handle = await app.mount({
      identity,
      props: {},
      services: {},
      signal: new AbortController().signal,
      target,
    });
    const ready = Promise.resolve(handle.ready);
    void ready.catch(() => undefined);

    await expect(ready).rejects.toBe(failure);
    expect(onError).toHaveBeenCalledWith(failure, expect.any(String));
    await handle.unmount();
  });

  it('keeps the render failure authoritative when the Vue error observer throws', async () => {
    const renderFailure = new Error('render failed');
    const observerFailure = new Error('error observer failed');
    const onError = vi.fn(() => {
      throw observerFailure;
    });
    const vueApp = {
      config: {},
      mount() {
        vueApp.config.errorHandler?.(renderFailure, null, 'render function');
      },
      provide: vi.fn(),
      unmount: vi.fn(),
    } as unknown as App;
    const app = defineVueApp<Record<string, never>, object>({
      createApp: (() => vueApp) as typeof createApp,
      onError,
      root: defineComponent(() => () => null),
    });

    const handle = await app.mount({
      identity,
      props: {},
      services: {},
      signal: new AbortController().signal,
      target: document.createElement('div'),
    });
    const ready = Promise.resolve(handle.ready);
    void ready.catch(() => undefined);

    await expect(ready).rejects.toBe(renderFailure);
    expect(onError).toHaveBeenCalledWith(renderFailure, 'render function');
    await handle.unmount();
  });

  it('composes a configured Vue error handler without losing readiness failures', async () => {
    const failure = new Error('configured render failed');
    const configuredErrorHandler = vi.fn();
    const onError = vi.fn();
    const Broken = defineComponent({
      setup: () => () => {
        throw failure;
      },
    });
    const app = defineVueApp<Record<string, never>, object>({
      configure(vueApp) {
        vueApp.config.errorHandler = configuredErrorHandler;
      },
      onError,
      root: Broken,
    });
    const handle = await app.mount({
      identity,
      props: {},
      services: {},
      signal: new AbortController().signal,
      target: document.createElement('div'),
    });

    await expect(handle.ready).rejects.toBe(failure);
    expect(configuredErrorHandler).toHaveBeenCalledWith(
      failure,
      expect.anything(),
      expect.any(String),
    );
    expect(onError).toHaveBeenCalledWith(failure, expect.any(String));
    await handle.unmount();
  });
});

describe('Vue host adapter', () => {
  function createMountedApplication() {
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
    return { instance, unmount, update };
  }

  it('mounts, updates and tears down remote applications without owning their DOM', async () => {
    const { instance, unmount, update } = createMountedApplication();
    let resolveMount!: (value: MountedApplication<Props, Source>) => void;
    const mountPromise = new Promise<MountedApplication<Props, Source>>((resolve) => {
      resolveMount = resolve;
    });
    const hostMount = vi.fn(() => mountPromise);
    const host = { mount: hostMount } as unknown as FrontsHost<Source, Services>;
    const onReady = vi.fn();
    const view = mountVue(RemoteApp, {
      props: {
        app: { name: 'checkout' },
        appProps: { value: 'first' },
        host: host as unknown as FrontsHost<unknown, object>,
        onReady,
        traceId: 'trace-vue-checkout',
      },
      slots: {
        loading: () => h('p', 'Loading checkout'),
      },
    });

    await nextTick();
    expect(view.text()).toContain('Loading checkout');
    resolveMount(instance);
    await flushPromises();
    expect(onReady).toHaveBeenCalledWith(instance);
    expect(hostMount).toHaveBeenCalledOnce();
    expect(hostMount).toHaveBeenCalledWith(
      expect.objectContaining({
        props: { value: 'first' },
        ref: { name: 'checkout' },
        traceId: 'trace-vue-checkout',
      }),
    );

    await view.setProps({ appProps: { value: 'second' } });
    await flushPromises();
    expect(update).toHaveBeenCalledWith({ value: 'second' });
    expect(unmount).not.toHaveBeenCalled();

    view.unmount();
    await flushPromises();
    expect(unmount).toHaveBeenCalledOnce();
  });

  it('renders a scoped fallback when host resolution or loading fails', async () => {
    const failure = new Error('registry unavailable');
    const host = {
      mount: vi.fn(async () => {
        throw failure;
      }),
    } as unknown as FrontsHost<unknown, object>;
    const view = mountVue(RemoteApp, {
      props: {
        app: { name: 'checkout' },
        appProps: { value: 'first' },
        host,
      },
      slots: {
        error: ({ error }: { error: Error }) => h('p', `Failed: ${error.message}`),
      },
    });

    await flushPromises();
    expect(view.text()).toContain('Failed: registry unavailable');
  });

  it('keeps remote state stable when Vue host observers throw', async () => {
    const { instance } = createMountedApplication();
    const observerFailure = new Error('observer failed');
    const onReady = vi.fn(() => {
      throw observerFailure;
    });
    const host = {
      mount: vi.fn(async () => instance),
    } as unknown as FrontsHost<Source, Services>;
    const Probe = defineComponent({
      setup() {
        const remote = useRemoteApp<Props, Source, Services>({
          app: { name: 'checkout' },
          appProps: { value: 'first' },
          host,
          onReady,
        });
        return () =>
          h('div', {
            'data-status': remote.status.value,
            ref: remote.target,
          });
      },
    });
    const view = mountVue(Probe);

    await flushPromises();
    expect(onReady).toHaveBeenCalledWith(instance);
    expect(view.attributes('data-status')).toBe('ready');
    view.unmount();
    await flushPromises();
    expect(instance.unmount).toHaveBeenCalledOnce();
  });

  it('ignores late update failures from an instance replaced by remount', async () => {
    const first = createMountedApplication();
    const second = createMountedApplication();
    let rejectOldUpdate!: (reason: unknown) => void;
    const oldUpdate = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectOldUpdate = reject;
        }),
    );
    const oldInstance = { ...first.instance, update: oldUpdate };
    const newInstance = {
      ...second.instance,
      identity: { ...second.instance.identity, instanceId: 'vue-new' },
    };
    const host = {
      mount: vi.fn().mockResolvedValueOnce(oldInstance).mockResolvedValueOnce(newInstance),
    } as unknown as FrontsHost<unknown, object>;
    const view = mountVue(RemoteApp, {
      props: {
        app: { name: 'checkout' },
        appProps: { value: 'first' },
        fallback: (failure: Error) => h('p', failure.message),
        host,
        mountKey: 1,
      },
    });
    await flushPromises();
    expect(view.attributes('data-fronts-vue-status')).toBe('ready');

    await view.setProps({ appProps: { value: 'second' } });
    await flushPromises();
    expect(oldUpdate).toHaveBeenCalledOnce();
    await view.setProps({ appProps: { value: 'third' }, mountKey: 2 });
    await flushPromises();
    expect(host.mount).toHaveBeenCalledTimes(2);
    expect(view.attributes('data-fronts-vue-status')).toBe('ready');

    rejectOldUpdate(new Error('stale update failed'));
    await flushPromises();
    expect(view.attributes('data-fronts-vue-status')).toBe('ready');
    expect(view.text()).not.toContain('stale update failed');
  });

  it('waits for prior teardown before remounting the same host slot', async () => {
    const first = createMountedApplication();
    const second = createMountedApplication();
    let finishUnmount!: () => void;
    const firstUnmount = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishUnmount = resolve;
        }),
    );
    const firstInstance = {
      ...first.instance,
      identity: { ...first.instance.identity, instanceId: 'shared-slot' },
      unmount: firstUnmount,
    };
    const secondInstance = {
      ...second.instance,
      identity: { ...second.instance.identity, instanceId: 'shared-slot' },
    };
    const host = {
      mount: vi.fn().mockResolvedValueOnce(firstInstance).mockResolvedValueOnce(secondInstance),
    } as unknown as FrontsHost<unknown, object>;
    const view = mountVue(RemoteApp, {
      props: {
        app: { name: 'checkout' },
        appProps: { value: 'first' },
        host,
        instanceId: 'shared-slot',
        mountKey: 1,
      },
    });
    await flushPromises();
    expect(host.mount).toHaveBeenCalledOnce();
    expect(view.attributes('data-fronts-vue-status')).toBe('ready');

    await view.setProps({ appProps: { value: 'second' }, mountKey: 2 });
    await flushPromises();
    expect(firstUnmount).toHaveBeenCalledOnce();
    expect(host.mount).toHaveBeenCalledOnce();

    finishUnmount();
    await flushPromises();
    expect(host.mount).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  it('can be embedded under an existing Vue application', () => {
    const Host = defineComponent({
      render: () => h('p', 'Host remains framework-owned'),
    });
    const view = mountVue(Host);
    expect((view.vm as ComponentPublicInstance).$el.textContent).toBe(
      'Host remains framework-owned',
    );
  });
});
