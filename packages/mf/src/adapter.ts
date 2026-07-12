import { FrontsError, frontsErrorCodes, throwIfAborted, type ResolvedApp } from '@fronts/core';
import type { PreloadRemoteArgs } from '@module-federation/runtime/types';

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
  assertModuleFederationSource(resolved.source);
  const force = resolved.source.force ?? options.force ?? false;
  options.instance.registerRemotes([resolved.source.remote], force ? { force: true } : undefined);
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
      registerRemote(resolved, options);
      const id = toModuleFederationId(resolved.source, resolved.ref);

      try {
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
      registerRemote(resolved, options);

      try {
        await options.instance.preloadRemote([createPreloadOptions(resolved, options)]);
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
            details: { remote: resolved.source.remote.name },
            phase: 'load',
          },
        );
      }
    },
  };
}
