export const FRONTS_APP_PROTOCOL = 'fronts.application' as const;

export const FRONTS_APP_PROTOCOL_VERSION = 2 as const;

export const FRONTS_APP_SYMBOL = Symbol.for('@fronts/core/application/v2');

/** @internal Marks host-created proxy applications whose capabilities are a negotiable maximum. */
export const FRONTS_NEGOTIABLE_CAPABILITIES_SYMBOL = Symbol.for(
  '@fronts/core/application/negotiable-capabilities/v2',
);
