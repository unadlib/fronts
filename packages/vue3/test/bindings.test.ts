import { flushPromises, mount as mountVue } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import {
  normalizeAppRef,
  type AppRef,
  type FrontsHost,
  type HostComposition,
  type MountedApplication,
} from '@fronts/core';

import { createVueBindings } from '../src/index.js';

interface ShopContracts {
  readonly account: { readonly userId: string };
  readonly checkout: { readonly cartId: string };
}

interface Source {
  readonly remote: string;
}

interface Services {
  readonly locale: string;
}

const applications = {
  account: { expose: './account-app', name: 'account' },
  checkout: { channel: 'stable', expose: './checkout-app', name: 'checkout' },
} as const;

function createMountedApplication<Props>(ref: AppRef, props: Props) {
  const normalized = normalizeAppRef(ref);
  return {
    abort: vi.fn(async () => undefined),
    activate: vi.fn(async () => undefined),
    deactivate: vi.fn(async () => undefined),
    identity: {
      instanceId: `${ref.name}-1`,
      name: ref.name,
      version: '2.0.0',
    },
    ready: Promise.resolve(),
    ref: normalized,
    resolved: { ref: normalized, source: { remote: ref.name } },
    state: 'ready',
    unmount: vi.fn(async () => undefined),
    update: vi.fn(async (next: Props) => {
      void next;
    }),
    props,
  } as MountedApplication<Props, Source> & { readonly props: Props };
}

function createComposition() {
  const instances: MountedApplication<object, Source>[] = [];
  const mount = vi.fn(async <Props>(options: { readonly props: Props; readonly ref: AppRef }) => {
    const instance = createMountedApplication(options.ref, options.props);
    instances.push(instance as MountedApplication<object, Source>);
    return instance;
  });
  const preload = vi.fn(async (ref: AppRef) => ({
    ref: normalizeAppRef(ref),
    source: { remote: ref.name },
  }));
  const host = { mount, preload } as unknown as FrontsHost<Source, Services>;
  const composition: HostComposition<ShopContracts, Source, Services> = { applications, host };
  return { composition, instances, mount, preload };
}

describe('createVueBindings', () => {
  it('maps inline controls to the typed application catalog and host mount', async () => {
    const { composition, instances, mount } = createComposition();
    const bindings = createVueBindings(composition);
    const onReady = vi.fn();
    const view = mountVue(bindings.App, {
      props: {
        app: 'checkout',
        container: 'shadow',
        onReady,
        props: { cartId: 'C-42' },
        selection: {
          ref: { channel: 'canary', range: '^2.1.0' },
          resolve: { environment: 'preview', tenant: 'acme' },
        },
        traceId: 'trace-checkout',
      },
    });

    await flushPromises();
    expect(onReady).toHaveBeenCalledOnce();
    expect(mount).toHaveBeenCalledWith(
      expect.objectContaining({
        container: { mode: 'open', type: 'shadow' },
        props: { cartId: 'C-42' },
        ref: {
          channel: 'canary',
          expose: './checkout-app',
          name: 'checkout',
          range: '^2.1.0',
        },
        resolve: { environment: 'preview', tenant: 'acme' },
        traceId: 'trace-checkout',
      }),
    );

    view.unmount();
    await flushPromises();
    expect(instances[0]?.unmount).toHaveBeenCalledOnce();
  });

  it('creates stable application components with bound defaults', async () => {
    const { composition, mount } = createComposition();
    const { component } = createVueBindings(composition);
    const Checkout = component('checkout', {
      container: 'dom',
      selection: { resolve: { cohort: 'staff' } },
      traceId: 'trace-bound-checkout',
    });

    const view = mountVue(Checkout, { props: { cartId: 'C-99' } });
    await flushPromises();
    expect(mount).toHaveBeenCalledWith(
      expect.objectContaining({
        container: { type: 'dom' },
        props: { cartId: 'C-99' },
        ref: expect.objectContaining({ expose: './checkout-app', name: 'checkout' }),
        resolve: { cohort: 'staff' },
        traceId: 'trace-bound-checkout',
      }),
    );
    view.unmount();
  });

  it('preloads through the same catalog and supports direct or curried typing', async () => {
    const { composition, preload } = createComposition();
    const direct = createVueBindings(composition);
    const curried = createVueBindings<ShopContracts>()(composition);

    await direct.preload('account', {
      selection: {
        ref: { channel: 'canary', range: '>=2' },
        resolve: { metadata: { experiment: 'summer' }, tenant: 'acme' },
      },
      traceId: 'trace-account',
    });
    await curried.preload('checkout');

    expect(preload).toHaveBeenNthCalledWith(
      1,
      {
        channel: 'canary',
        expose: './account-app',
        name: 'account',
        range: '>=2',
      },
      {
        metadata: { experiment: 'summer' },
        tenant: 'acme',
        traceId: 'trace-account',
      },
    );
    expect(preload).toHaveBeenNthCalledWith(
      2,
      { channel: 'stable', expose: './checkout-app', name: 'checkout' },
      {},
    );
  });
});
