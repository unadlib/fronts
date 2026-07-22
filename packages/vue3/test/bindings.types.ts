import type { FunctionalComponent } from 'vue';

import type { ContainerRequest, FrontsHost, HostComposition } from '@fronts/core';

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

interface IframeRequest extends ContainerRequest {
  readonly sandbox: readonly string[];
  readonly type: 'iframe';
}

type PropsOf<Component> = Component extends FunctionalComponent<infer Props> ? Props : never;

declare const host: FrontsHost<Source, Services>;

const composition: HostComposition<ShopContracts, Source, Services> = {
  applications: {
    account: { expose: './account-app', name: 'account' },
    checkout: { expose: './checkout-app', name: 'checkout' },
  },
  host,
};

const inferred = createVueBindings(composition);
const explicit = createVueBindings<ShopContracts>()(composition);
const Checkout = inferred.component('checkout', { container: 'shadow' });
const IframeCheckout = inferred.component<'checkout', IframeRequest>('checkout', {
  container: { sandbox: ['allow-scripts'], type: 'iframe' },
});

const checkout: PropsOf<typeof Checkout> = { cartId: 'C-42' };
const iframeCheckout: PropsOf<typeof IframeCheckout> = { cartId: 'C-iframe' };
const inlineCheckout: PropsOf<typeof inferred.App> = {
  app: 'checkout',
  container: 'dom',
  props: { cartId: 'C-inline' },
};
const inlineAccount: PropsOf<typeof explicit.App> = {
  app: 'account',
  props: { userId: 'U-1' },
};

// @ts-expect-error checkout accepts its own props contract only
const wrongComponent: PropsOf<typeof Checkout> = { userId: 'U-1' };
// @ts-expect-error the selected inline app and its props stay correlated
const wrongInline: PropsOf<typeof inferred.App> = { app: 'checkout', props: { userId: 'U-1' } };

declare const selected: 'account' | 'checkout';
// @ts-expect-error a union app name cannot safely use only one branch's props
const unsafeUnion: PropsOf<typeof inferred.App> = { app: selected, props: { cartId: 'C-union' } };

void checkout;
void iframeCheckout;
void inlineCheckout;
void inlineAccount;
void wrongComponent;
void wrongInline;
void unsafeUnion;
void explicit;
void Checkout;
void IframeCheckout;
