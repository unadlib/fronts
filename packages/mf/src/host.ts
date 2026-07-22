import { createInstance, type ModuleFederation } from '@module-federation/runtime';
import type { Remote, UserOptions } from '@module-federation/runtime/types';

import {
  FrontsError,
  createFrontsHost,
  createStaticResolver,
  frontsErrorCodes,
  normalizeAppRef,
  type AppRef,
  type AppResolver,
  type ApplicationCatalog,
  type ApplicationContractShape,
  type ApplicationName,
  type FrontsHostOptions,
  type HostComposition,
  type StaticResolution,
} from '@fronts/core';

import { createModuleFederationAdapter } from './adapter.js';
import { createModuleFederationSource } from './source.js';
import type { ModuleFederationSource } from './types.js';

export interface RemoteDeployment {
  /** Official Module Federation remote name. */
  readonly remote: string;
  /** Concrete manifest or remote entry accepted by the official runtime. */
  readonly entry: string;
  /** Required for raw entries whose format cannot be inferred from a manifest. */
  readonly type?: Remote['type'];
  readonly alias?: string;
  readonly entryGlobalName?: string;
  readonly shareScope?: string | readonly string[];
  /** Defaults to "./application". All candidates for one application must use the same expose. */
  readonly expose?: `./${string}`;
  /** Immutable deployment version used by Fronts identity, audit, and conflict detection. */
  readonly version?: string;
  /** Deployment data exposed to container resolvers, policy, and observability. */
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** Passed to the existing Module Federation adapter. */
  readonly force?: boolean;
  readonly preload?: ModuleFederationSource['preload'];
}

/** Selector fields supported by the existing static resolver. */
export interface DeploymentMatch {
  readonly range?: string;
  readonly channel?: string;
  readonly environment?: string;
  readonly tenant?: string;
  readonly cohort?: string;
}

export type StaticDeployment = RemoteDeployment & { readonly match?: DeploymentMatch };

export type StaticDeployments<Contracts extends ApplicationContractShape<Contracts>> = Readonly<{
  [Name in ApplicationName<Contracts>]-?:
    RemoteDeployment | readonly [StaticDeployment, ...StaticDeployment[]];
}>;

/** Reference defaults required when a caller supplies its own resolver. */
export type ApplicationReferences<Contracts extends ApplicationContractShape<Contracts>> =
  Readonly<{
    [Name in ApplicationName<Contracts>]-?: Readonly<Omit<AppRef, 'name'>>;
  }>;

export type RuntimeConfiguration =
  | {
      /** Existing official runtime instance; its lifecycle remains caller-owned. */
      readonly runtime: ModuleFederation;
      readonly runtimeOptions?: never;
      readonly runtimeName?: never;
    }
  | {
      readonly runtime?: never;
      /** Forwarded to createInstance(); name and remotes remain factory-owned. */
      readonly runtimeOptions?: Omit<UserOptions, 'name' | 'remotes'>;
      /** Official runtime instance name. Defaults to the Fronts host name. */
      readonly runtimeName?: string;
    };

type MfHostBaseOptions<Services extends object> = Omit<
  FrontsHostOptions<ModuleFederationSource, Services>,
  'loader' | 'resolver'
> &
  RuntimeConfiguration & {
    /** Fronts host identity and the default hostId. */
    readonly name: string;
  };

export type MfHostOptions<
  Contracts extends ApplicationContractShape<Contracts>,
  Services extends object,
> = MfHostBaseOptions<Services> &
  (
    | {
        readonly apps: StaticDeployments<Contracts>;
        readonly applications?: never;
        readonly resolver?: never;
      }
    | {
        readonly applications: ApplicationReferences<Contracts>;
        readonly resolver: AppResolver<ModuleFederationSource>;
        readonly apps?: never;
      }
  );

export interface MfHostResult<
  Contracts extends ApplicationContractShape<Contracts>,
  Services extends object,
> extends HostComposition<Contracts, ModuleFederationSource, Services> {
  readonly runtime: ModuleFederation;
}

function configurationError(message: string, details?: Readonly<Record<string, unknown>>): never {
  throw new FrontsError(frontsErrorCodes.resolutionFailed, message, {
    ...(details === undefined ? {} : { details }),
    phase: 'resolve',
  });
}

function createRemote(deployment: RemoteDeployment): Remote {
  return {
    entry: deployment.entry,
    name: deployment.remote,
    ...(deployment.alias === undefined ? {} : { alias: deployment.alias }),
    ...(deployment.entryGlobalName === undefined
      ? {}
      : { entryGlobalName: deployment.entryGlobalName }),
    ...(deployment.shareScope === undefined
      ? {}
      : {
          shareScope:
            typeof deployment.shareScope === 'string'
              ? deployment.shareScope
              : [...deployment.shareScope],
        }),
    ...(deployment.type === undefined ? {} : { type: deployment.type }),
  };
}

function createSource(deployment: RemoteDeployment): ModuleFederationSource {
  return createModuleFederationSource(createRemote(deployment), {
    ...(deployment.force === undefined ? {} : { force: deployment.force }),
    ...(deployment.preload === undefined ? {} : { preload: deployment.preload }),
  });
}

function createCatalog<Contracts extends ApplicationContractShape<Contracts>>(
  references: ApplicationReferences<Contracts>,
): ApplicationCatalog<Contracts> {
  const applications: Record<string, Readonly<AppRef>> = Object.create(null) as Record<
    string,
    Readonly<AppRef>
  >;
  for (const [name, reference] of Object.entries(references) as readonly [
    string,
    Readonly<Omit<AppRef, 'name'>>,
  ][]) {
    applications[name] = Object.freeze(normalizeAppRef({ ...reference, name }));
  }
  return Object.freeze(applications) as ApplicationCatalog<Contracts>;
}

function createStaticConfiguration<Contracts extends ApplicationContractShape<Contracts>>(
  apps: StaticDeployments<Contracts>,
): {
  readonly applications: ApplicationCatalog<Contracts>;
  readonly resolver: AppResolver<ModuleFederationSource>;
} {
  const references: Record<string, Omit<AppRef, 'name'>> = Object.create(null) as Record<
    string,
    Omit<AppRef, 'name'>
  >;
  const resolutions: StaticResolution<ModuleFederationSource>[] = [];

  for (const [name, configured] of Object.entries(apps)) {
    const candidates: readonly StaticDeployment[] = Array.isArray(configured)
      ? configured
      : [configured as StaticDeployment];
    if (candidates.length === 0) {
      configurationError(`Application "${name}" must declare at least one deployment.`, { name });
    }

    const exposes = new Set(
      candidates.map(
        (candidate) =>
          normalizeAppRef({
            name,
            ...(candidate.expose === undefined ? {} : { expose: candidate.expose }),
          }).expose,
      ),
    );
    if (exposes.size !== 1) {
      configurationError(`Application "${name}" has deployments with different exposes.`, {
        exposes: [...exposes],
        name,
      });
    }
    const expose = [...exposes][0];
    if (expose === undefined) {
      configurationError(`Application "${name}" has no normalized expose.`, { name });
    }
    references[name] = Object.freeze({ expose });

    for (const candidate of candidates) {
      resolutions.push({
        match: { ...candidate.match, expose, name },
        resolve: {
          source: createSource(candidate),
          ...(candidate.version === undefined ? {} : { version: candidate.version }),
          ...(candidate.metadata === undefined ? {} : { metadata: candidate.metadata }),
        },
      });
    }
  }

  return {
    applications: createCatalog(references as ApplicationReferences<Contracts>),
    resolver: createStaticResolver(resolutions),
  };
}

export function createMfHost<
  Contracts extends ApplicationContractShape<Contracts>,
  Services extends object = object,
>(options: MfHostOptions<Contracts, Services>): MfHostResult<Contracts, Services> {
  const {
    applications,
    apps,
    name,
    resolver,
    runtime: suppliedRuntime,
    runtimeName,
    runtimeOptions,
    ...hostOptions
  } = options;
  let configured: {
    readonly applications: ApplicationCatalog<Contracts>;
    readonly resolver: AppResolver<ModuleFederationSource>;
  };
  if (apps !== undefined) {
    configured = createStaticConfiguration(apps);
  } else {
    if (applications === undefined || resolver === undefined) {
      configurationError('A custom resolver requires an application reference catalog.');
    }
    configured = {
      applications: createCatalog(applications),
      resolver,
    };
  }
  const runtime =
    suppliedRuntime ??
    createInstance({
      ...runtimeOptions,
      name: runtimeName ?? name,
      remotes: [],
    });
  const host = createFrontsHost<ModuleFederationSource, Services>({
    ...hostOptions,
    hostId: hostOptions.hostId ?? name,
    loader: createModuleFederationAdapter({ instance: runtime }),
    resolver: configured.resolver,
  });

  return Object.freeze({
    applications: configured.applications,
    host,
    runtime,
  });
}
