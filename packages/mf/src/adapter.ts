import { FrontsError, frontsErrorCodes, throwIfAborted, type ResolvedApp } from '@fronts/core';
import type { PreloadRemoteArgs, Remote } from '@module-federation/runtime/types';

import { assertModuleFederationSource, toModuleFederationId } from './source.js';
import type {
  ModuleFederationAdapter,
  ModuleFederationAdapterOptions,
  ModuleFederationSource,
} from './types.js';

function registerRemote(
  resolved: ResolvedApp<ModuleFederationSource>,
  options: ModuleFederationAdapterOptions,
): void {
  const force = resolved.source.force ?? options.force ?? false;
  const configuredRemote = resolved.source.remote;
  const runtimeRemote: Remote = {
    ...configuredRemote,
    ...(Array.isArray(configuredRemote.shareScope)
      ? { shareScope: [...configuredRemote.shareScope] }
      : {}),
  };
  options.instance.registerRemotes([runtimeRemote], force ? { force: true } : undefined);
}

function createPreloadOptions(
  resolved: ResolvedApp<ModuleFederationSource>,
  options: ModuleFederationAdapterOptions,
): PreloadRemoteArgs {
  const source = resolved.source;
  return {
    ...options.preload,
    ...source.preload,
    exposes: [resolved.ref.expose],
    nameOrAlias: source.remote.alias ?? source.remote.name,
  };
}

export function createModuleFederationAdapter(
  options: ModuleFederationAdapterOptions,
): ModuleFederationAdapter {
  return {
    async load(resolved, context): Promise<unknown> {
      throwIfAborted(context.signal, 'load');
      let id = resolved.ref.name;

      try {
        assertModuleFederationSource(resolved.source);
        id = toModuleFederationId(resolved.source, resolved.ref);
        registerRemote(resolved, options);
        throwIfAborted(context.signal, 'load');
        const loaded = await options.instance.loadRemote<unknown>(id, { from: 'runtime' });
        throwIfAborted(context.signal, 'load');
        if (loaded === null) {
          throw new FrontsError(
            frontsErrorCodes.loadFailed,
            `Module Federation returned no module for "${id}".`,
            { details: { id }, phase: 'load' },
          );
        }
        return loaded;
      } catch (error) {
        throwIfAborted(context.signal, 'load');
        if (error instanceof FrontsError) {
          throw error;
        }
        throw new FrontsError(
          frontsErrorCodes.loadFailed,
          `Module Federation failed to load "${id}".`,
          { cause: error, details: { id }, phase: 'load' },
        );
      }
    },

    async preload(resolved, context): Promise<void> {
      throwIfAborted(context.signal, 'load');
      let remoteName = resolved.ref.name;

      try {
        assertModuleFederationSource(resolved.source);
        remoteName = resolved.source.remote.name;
        const preloadOptions = createPreloadOptions(resolved, options);
        registerRemote(resolved, options);
        throwIfAborted(context.signal, 'load');
        await options.instance.preloadRemote([preloadOptions]);
        throwIfAborted(context.signal, 'load');
      } catch (error) {
        throwIfAborted(context.signal, 'load');
        if (error instanceof FrontsError) {
          throw error;
        }
        throw new FrontsError(
          frontsErrorCodes.loadFailed,
          `Module Federation failed to preload "${resolved.ref.name}".`,
          {
            cause: error,
            details: { remote: remoteName },
            phase: 'load',
          },
        );
      }
    },
  };
}
