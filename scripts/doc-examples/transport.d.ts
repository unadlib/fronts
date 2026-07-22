/// <reference path="./services.d.ts" />

/**
 * A composed Host and the transport values around it.
 *
 * Fixtures share one ambient namespace, so an identifier is declared exactly once across the whole
 * set. `host` lives here and every other fixture layers on top of it.
 */
declare const mySource: { readonly entry: string };
declare const checkoutSource: { readonly entry: string };
declare const myLoader: import('@fronts/core').AppLoader<{ readonly entry: string }>;
declare const checkoutLoader: import('@fronts/core').AppLoader<{ readonly entry: string }>;

declare const host: import('@fronts/core').FrontsHost<
  import('@fronts/mf').ModuleFederationSource,
  HostServices
>;
