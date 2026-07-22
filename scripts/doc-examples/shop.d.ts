/// <reference path="./transport.d.ts" />

/**
 * The composition root the composition-shortcuts examples assume has already run.
 *
 * Every factory is bound with `typeof import(...)` rather than a restated signature, so a change to
 * the real declaration reaches these examples instead of being masked by the fixture.
 */
declare const createMfHost: typeof import('@fronts/mf').createMfHost;
declare const createReactBindings: typeof import('@fronts/react').createReactBindings;
declare const createVueBindings: typeof import('@fronts/vue3').createVueBindings;
declare const h: typeof import('vue').h;
declare const defineComponent: typeof import('vue').defineComponent;

interface ShopContracts {
  readonly account: { readonly accountId: string };
  readonly checkout: { readonly cartId: string };
}

type Source = import('@fronts/mf').ModuleFederationSource;
type IframeContainerRequest = import('@fronts/core/iframe').IframeContainerRequest;

declare const applications: import('@fronts/core').ApplicationCatalog<ShopContracts>;
declare const composition: import('@fronts/core').HostComposition<
  ShopContracts,
  Source,
  HostServices
>;

declare const shop: import('@fronts/react').ReactBindings<ShopContracts, Source>;
declare const react: import('@fronts/react').ReactBindings<ShopContracts, Source>;
declare const vue: import('@fronts/vue3').VueBindings<ShopContracts, Source>;

declare const runtime: import('@module-federation/runtime').ModuleFederation;
declare const registryResolver: import('@fronts/core').AppResolver<Source>;
declare const capabilityPolicy: import('@fronts/core').CapabilityPolicy<HostServices>;
declare const iframeContainer: import('@fronts/core').ContainerRequestResolver<
  Source,
  IframeContainerRequest
>;

declare const cartId: string;
declare const tenantId: string;
