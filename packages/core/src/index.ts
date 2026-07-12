export {
  FRONTS_APP_PROTOCOL,
  FRONTS_APP_PROTOCOL_VERSION,
  FRONTS_APP_SYMBOL,
  assertAppHandle,
  assertFrontsApp,
  defineApp,
  getFrontsApp,
  isFrontsApp,
  isFrontsAppModule,
} from './app/index.js';
export type {
  AppHandle,
  ApplicationIdentity,
  FrontsApp,
  FrontsAppDefinition,
  FrontsAppModule,
  MaybePromise,
  MountContext,
  MountTarget,
  ServiceKey,
} from './app/index.js';
export { FrontsError, frontsErrorCodes, isFrontsError } from './errors.js';
export type { FrontsErrorCode, FrontsErrorOptions, FrontsPhase } from './errors.js';
