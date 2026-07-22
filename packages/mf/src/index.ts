export { createModuleFederationAdapter } from './adapter.js';
export { createMfHost } from './host.js';
export type {
  ApplicationReferences,
  DeploymentMatch,
  MfHostOptions,
  MfHostResult,
  RemoteDeployment,
  RuntimeConfiguration,
  StaticDeployment,
  StaticDeployments,
} from './host.js';
export {
  assertModuleFederationSource,
  createModuleFederationSource,
  toModuleFederationId,
} from './source.js';
export type {
  ModuleFederationAdapter,
  ModuleFederationAdapterOptions,
  ModuleFederationInstance,
  ModuleFederationSource,
} from './types.js';
