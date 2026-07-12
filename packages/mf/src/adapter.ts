import { FrontsError, frontsErrorCodes, throwIfAborted, type ResolvedApp } from '@fronts/core';
import type { PreloadRemoteArgs, Remote } from '@module-federation/runtime/types';

import { assertModuleFederationSource, toModuleFederationId } from './source.js';
import type {
  ModuleFederationAdapter,
  ModuleFederationAdapterOptions,
  ModuleFederationSource,
} from './types.js';

interface RegisteredDeployment {
  readonly fingerprint: string;
  readonly version?: string;
}

const registeredDeployments = new WeakMap<
  ModuleFederationAdapterOptions['instance'],
  Map<string, RegisteredDeployment>
>();

function createRemoteFingerprint(remote: Remote): string {
  return JSON.stringify([
    'entry' in remote ? remote.entry : null,
    'version' in remote ? remote.version : null,
    remote.alias ?? null,
    remote.shareScope ?? null,
    remote.type ?? null,
    remote.entryGlobalName ?? null,
  ]);
}

function registerRemote(
  resolved: ResolvedApp<ModuleFederationSource>,
  options: ModuleFederationAdapterOptions,
): void {
  const force = resolved.source.force ?? options.force ?? false;
  const configuredRemote = resolved.source.remote;
  const deployments = registeredDeployments.get(options.instance) ?? new Map();
  const registered = deployments.get(configuredRemote.name);
  const requested: RegisteredDeployment = {
    fingerprint: createRemoteFingerprint(configuredRemote),
    ...(resolved.version === undefined ? {} : { version: resolved.version }),
  };
  const versionConflict =
    registered?.version !== undefined &&
    requested.version !== undefined &&
    registered.version !== requested.version;
  if (
    force === false &&
    registered !== undefined &&
    (registered.fingerprint !== requested.fingerprint || versionConflict)
  ) {
    throw new FrontsError(
      frontsErrorCodes.loadFailed,
      `Module Federation remote "${configuredRemote.name}" is already bound to another deployment.`,
      {
        details: {
          remote: configuredRemote.name,
          ...(registered.version === undefined ? {} : { registeredVersion: registered.version }),
          ...(requested.version === undefined ? {} : { requestedVersion: requested.version }),
        },
        phase: 'load',
      },
    );
  }
  const runtimeRemote: Remote = {
    ...configuredRemote,
    ...(Array.isArray(configuredRemote.shareScope)
      ? { shareScope: [...configuredRemote.shareScope] }
      : {}),
  };
  options.instance.registerRemotes([runtimeRemote], force ? { force: true } : undefined);
  deployments.set(configuredRemote.name, {
    ...requested,
    ...(requested.version === undefined && registered?.version !== undefined
      ? { version: registered.version }
      : {}),
  });
  registeredDeployments.set(options.instance, deployments);
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
        toModuleFederationId(resolved.source, resolved.ref);
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
