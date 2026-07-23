import type { FrontsHost, HostComposition } from '../src/index.js';

interface ShopContracts {
  readonly account: { readonly accountId: string };
  readonly checkout: { readonly cartId: string };
}

interface IncompatibleContracts {
  readonly account: { readonly email: string };
  readonly checkout: { readonly orderId: number };
}

interface OptionalContracts {
  readonly checkout?: { readonly cartId: string };
}

interface Source {
  readonly entry: string;
}

interface Services {
  readonly locale: string;
}

declare const composition: HostComposition<ShopContracts, Source, Services>;

const compatible: HostComposition<ShopContracts, Source, Services> = composition;

// @ts-expect-error equal application names do not make different props contracts compatible
const incompatible: HostComposition<IncompatibleContracts, Source, Services> = composition;

// @ts-expect-error every logical application contract must be required
declare const optional: HostComposition<OptionalContracts, Source, Services>;

declare const host: FrontsHost<Source, Services>;
const manual: HostComposition<ShopContracts, Source, Services> = {
  applications: {
    account: { name: 'account' },
    checkout: { name: 'checkout' },
  },
  host,
};

void compatible;
void incompatible;
void optional;
void manual;
