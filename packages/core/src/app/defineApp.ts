import {
  FRONTS_APP_PROTOCOL,
  FRONTS_APP_PROTOCOL_VERSION,
  FRONTS_APP_SYMBOL,
} from './constants.js';
import type { FrontsApp, FrontsAppDefinition } from './types.js';

type BrandedFrontsApp = {
  readonly [FRONTS_APP_SYMBOL]: true;
};

export function defineApp<Props = unknown, Services extends object = object>(
  definition: FrontsAppDefinition<Props, Services>,
): FrontsApp<Props, Services> {
  const app = definition as FrontsAppDefinition<Props, Services> &
    Partial<FrontsApp<Props, Services>> &
    Partial<BrandedFrontsApp>;

  Object.defineProperties(app, {
    [FRONTS_APP_SYMBOL]: {
      configurable: false,
      enumerable: false,
      value: true,
      writable: false,
    },
    protocol: {
      configurable: false,
      enumerable: true,
      value: FRONTS_APP_PROTOCOL,
      writable: false,
    },
    protocolVersion: {
      configurable: false,
      enumerable: true,
      value: FRONTS_APP_PROTOCOL_VERSION,
      writable: false,
    },
  });

  return app as FrontsApp<Props, Services>;
}
