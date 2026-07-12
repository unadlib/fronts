export {
  FRONTS_APP_PROTOCOL,
  FRONTS_APP_PROTOCOL_VERSION,
  FRONTS_APP_SYMBOL,
} from './constants.js';
export { defineApp } from './defineApp.js';
export {
  assertAppHandle,
  assertFrontsApp,
  getFrontsApp,
  isFrontsApp,
  isFrontsAppModule,
} from './validation.js';
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
} from './types.js';
