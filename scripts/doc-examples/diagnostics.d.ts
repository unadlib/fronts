/// <reference path="./transport.d.ts" />

/** The shell's own logger, whatever it happens to be. */
declare const logger: { error(message: string, data?: unknown): void };

/** A mount request the surrounding prose already built. */
declare const options: import('@fronts/core').MountAppOptions<
  { readonly message: string },
  import('@fronts/core').BuiltInContainerRequest,
  import('@fronts/mf').ModuleFederationSource
>;
