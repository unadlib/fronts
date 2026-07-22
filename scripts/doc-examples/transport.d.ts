/// <reference path="./services.d.ts" />

/** A resolved deployment source and its loader, stood in for by the transport a shell chooses. */
declare const mySource: { readonly entry: string };
declare const checkoutSource: { readonly entry: string };
declare const myLoader: import('@fronts/core').AppLoader<{ readonly entry: string }>;
declare const checkoutLoader: import('@fronts/core').AppLoader<{ readonly entry: string }>;

/** A composed Host, as returned by the composition root each example assumes has already run. */
declare const host: import('@fronts/core').FrontsHost<{ readonly entry: string }, HostServices>;
