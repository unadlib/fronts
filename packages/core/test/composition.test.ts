import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  ApplicationCatalog,
  ApplicationName,
  FrontsHost,
  HostComposition,
} from '../src/index.js';

interface ShopContracts {
  readonly account: { readonly accountId: string };
  readonly checkout: { readonly cartId: string };
}

describe('host composition contract', () => {
  it('keeps logical names paired with their runtime references', () => {
    const applications = {
      account: { name: 'account' },
      checkout: { expose: './checkout-application', name: 'checkout' },
    } as const satisfies ApplicationCatalog<ShopContracts>;

    expect(applications.checkout).toEqual({
      expose: './checkout-application',
      name: 'checkout',
    });
    expectTypeOf<ApplicationName<ShopContracts>>().toEqualTypeOf<'account' | 'checkout'>();
    expectTypeOf(applications.checkout.name).toEqualTypeOf<'checkout'>();
  });

  it('carries source and service types without adding runtime state', () => {
    interface Source {
      readonly entry: string;
    }
    interface Services {
      readonly telemetry: { emit(name: string): void };
    }

    const host = {} as FrontsHost<Source, Services>;
    const composition = {
      applications: {
        account: { name: 'account' },
        checkout: { name: 'checkout' },
      },
      host,
    } satisfies HostComposition<ShopContracts, Source, Services>;

    expect(composition.host).toBe(host);
    expectTypeOf(composition.host).toEqualTypeOf<FrontsHost<Source, Services>>();
  });
});
