import type { AppLoader } from '@fronts/core';
import type { ModuleFederation } from '@module-federation/runtime';
import type { PreloadRemoteArgs, Remote } from '@module-federation/runtime/types';

export type ModuleFederationInstance = Pick<
  ModuleFederation,
  'loadRemote' | 'preloadRemote' | 'registerRemotes'
>;

export interface ModuleFederationSource {
  readonly remote: Remote;
  readonly force?: boolean;
  readonly preload?: Omit<PreloadRemoteArgs, 'nameOrAlias' | 'exposes'>;
}

export interface ModuleFederationAdapterOptions {
  readonly instance: ModuleFederationInstance;
  readonly force?: boolean;
  readonly preload?: Omit<PreloadRemoteArgs, 'nameOrAlias' | 'exposes'>;
}

export type ModuleFederationAdapter = AppLoader<ModuleFederationSource>;
