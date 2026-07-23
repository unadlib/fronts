import type { ContainerRequest, FrontsHost, HostComposition } from '@fronts/core';

import { createReactBindings } from '../src/index.js';

interface ShopContracts {
  readonly account: { readonly userId: string };
  readonly checkout: { readonly cartId: string };
}

interface IncompatibleContracts {
  readonly account: { readonly email: string };
  readonly checkout: { readonly orderId: number };
}

interface OptionalContracts {
  readonly checkout?: { readonly cartId: string };
}

interface ReservedContracts {
  readonly keyed: { readonly key: string; readonly value: string };
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

declare const host: FrontsHost<Source, Services>;

const composition: HostComposition<ShopContracts, Source, Services> = {
  applications: {
    account: { expose: './account-app', name: 'account' },
    checkout: { expose: './checkout-app', name: 'checkout' },
  },
  host,
};

const inferred = createReactBindings(composition);
const explicit = createReactBindings<ShopContracts>()(composition);
// @ts-expect-error a typed composition cannot be rebound to unrelated props contracts
const incompatible = createReactBindings<IncompatibleContracts>()(composition);
// @ts-expect-error logical application contracts cannot be optional
const optional = createReactBindings<OptionalContracts>();
const Checkout = inferred.component('checkout', { container: 'shadow' });
const IframeCheckout = inferred.component<'checkout', IframeRequest>('checkout', {
  container: { sandbox: ['allow-scripts'], type: 'iframe' },
});

const checkout = <Checkout cartId="C-42" />;
const iframeCheckout = <IframeCheckout cartId="C-iframe" />;
const inlineCheckout = (
  <inferred.App app="checkout" container="dom" props={{ cartId: 'C-inline' }} />
);
const inlineAccount = <explicit.App app="account" props={{ userId: 'U-1' }} />;

declare const reservedComposition: HostComposition<ReservedContracts, Source, Services>;
const reserved = createReactBindings(reservedComposition);
// @ts-expect-error React consumes key before component props reach the remote application
const Keyed = reserved.component('keyed');
const inlineKeyed = <reserved.App app="keyed" props={{ key: 'instance-1', value: 'safe' }} />;

// @ts-expect-error checkout accepts its own props contract only
const wrongComponent = <Checkout userId="U-1" />;
// @ts-expect-error the selected inline app and its props stay correlated
const wrongInline = <inferred.App app="checkout" props={{ userId: 'U-1' }} />;

declare const selected: 'account' | 'checkout';
// @ts-expect-error a union app name cannot safely use only one branch's props
const unsafeUnion = <inferred.App app={selected} props={{ cartId: 'C-union' }} />;

void checkout;
void iframeCheckout;
void inlineCheckout;
void inlineAccount;
void inlineKeyed;
void Keyed;
void wrongComponent;
void wrongInline;
void unsafeUnion;
void incompatible;
void optional;
