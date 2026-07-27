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
  type StaticResolutionMatch,
} from '@fronts/core';

import { createModuleFederationAdapter } from './adapter.js';
import { createModuleFederationSource } from './source.js';
import type { ModuleFederationAdapter, ModuleFederationSource } from './types.js';

interface RemoteDeploymentBase {
  /** Official Module Federation remote name. */
  readonly remote: string;
  /** Required for raw entries whose format cannot be inferred from a manifest. */
  readonly type?: Remote['type'];
  readonly alias?: string;
  readonly entryGlobalName?: string;
  readonly shareScope?: string | readonly string[];
  /** Defaults to "./application". All candidates for one application must use the same expose. */
  readonly expose?: `./${string}`;
  /**
   * Immutable deployment version used by Fronts identity, audit, and conflict detection.
   *
   * This is Fronts bookkeeping, not the official remote selector. Use `remoteVersion` to ask the
   * official runtime to resolve a remote by version.
   */
  readonly version?: string;
  /** Deployment data exposed to container resolvers, policy, and observability. */
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** Passed to the existing Module Federation adapter. */
  readonly force?: boolean;
  readonly preload?: ModuleFederationSource['preload'];
}

/**
 * One official remote, addressed the way the official `Remote` type allows.
 *
 * The official runtime accepts exactly one of an entry or a version, so this mirrors that contract
 * rather than narrowing it. An entry names a concrete manifest or remote entry; a `remoteVersion`
 * asks the runtime's own registry to resolve one.
 */
export type RemoteDeployment =
  | (RemoteDeploymentBase & {
      /** Concrete manifest or remote entry accepted by the official runtime. */
      readonly entry: string;
      readonly remoteVersion?: never;
    })
  | (RemoteDeploymentBase & {
      readonly entry?: never;
      /** Version selector resolved by the official runtime, not by Fronts. */
      readonly remoteVersion: string;
    });

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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const deploymentFields = [
  'alias',
  'entry',
  'entryGlobalName',
  'expose',
  'force',
  'match',
  'metadata',
  'preload',
  'remote',
  'remoteVersion',
  'shareScope',
  'type',
  'version',
] as const satisfies readonly (keyof StaticDeployment)[];

const deploymentMatchFields = [
  'range',
  'channel',
  'environment',
  'tenant',
  'cohort',
] as const satisfies readonly (keyof DeploymentMatch)[];

// Compile-time completeness guards. `satisfies` above rejects a typo or an extra name; these reject
// a new StaticDeployment or DeploymentMatch field that was added without also guarding it here. Each
// annotation names the missing field, so a drift failure reads as the field it forgot.
type UnguardedDeploymentField = Exclude<keyof StaticDeployment, (typeof deploymentFields)[number]>;
type UnguardedMatchField = Exclude<keyof DeploymentMatch, (typeof deploymentMatchFields)[number]>;
const deploymentFieldsAreExhaustive: [UnguardedDeploymentField] extends [never]
  ? true
  : UnguardedDeploymentField = true;
const matchFieldsAreExhaustive: [UnguardedMatchField] extends [never] ? true : UnguardedMatchField =
  true;
void deploymentFieldsAreExhaustive;
void matchFieldsAreExhaustive;

function assertOwnDeploymentFields(
  value: unknown,
  name: string,
): asserts value is StaticDeployment {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    configurationError(`Application "${name}" must declare deployment objects.`, { name });
  }
  for (const field of deploymentFields) {
    if (field in value && !Object.hasOwn(value, field)) {
      configurationError(
        `Application "${name}" deployment field "${field}" must be an own property.`,
        { field, name },
      );
    }
  }
}

/**
 * Rejects a deployment that names neither or both remote addresses.
 *
 * The low-level source enforces the same rule, but only once a mount reaches the loader. Failing at
 * composition keeps an unreachable deployment from being discovered by the first user who needs it.
 */
function assertRemoteAddress(deployment: StaticDeployment, name: string): void {
  const hasEntry = Object.hasOwn(deployment, 'entry') && deployment.entry !== undefined;
  const hasRemoteVersion =
    Object.hasOwn(deployment, 'remoteVersion') && deployment.remoteVersion !== undefined;
  if (hasEntry === hasRemoteVersion) {
    configurationError(
      `Application "${name}" must declare exactly one of "entry" or "remoteVersion".`,
      { name },
    );
  }
  const address = hasEntry ? deployment.entry : deployment.remoteVersion;
  if (typeof address !== 'string' || address.trim() === '' || address !== address.trim()) {
    configurationError(
      `Application "${name}" ${hasEntry ? 'entry' : 'remoteVersion'} must be a trimmed string.`,
      { name },
    );
  }
}

function normalizeApplicationName(name: string): string {
  const normalizedName = normalizeAppRef({ name }).name;
  if (normalizedName !== name) {
    configurationError(`Application name "${name}" must already be normalized.`, {
      name,
      normalizedName,
    });
  }
  return normalizedName;
}

function createDeploymentMatch(
  deployment: StaticDeployment,
  name: string,
  expose: string,
): StaticResolutionMatch {
  const match = deployment.match;
  if (match === undefined) {
    return Object.freeze({ expose, name });
  }
  if (!isRecord(match)) {
    configurationError(`Application "${name}" deployment match must be an object.`, { name });
  }
  for (const field of deploymentMatchFields) {
    if (field in match && !Object.hasOwn(match, field)) {
      configurationError(
        `Application "${name}" deployment match field "${field}" must be an own property.`,
        { field, name },
      );
    }
  }

  const readMatchString = (field: (typeof deploymentMatchFields)[number]) => {
    const value = Object.hasOwn(match, field) ? match[field] : undefined;
    if (value !== undefined && typeof value !== 'string') {
      configurationError(
        `Application "${name}" deployment match field "${field}" must be a string.`,
        { field, name },
      );
    }
    return value;
  };
  const range = readMatchString('range');
  const channel = readMatchString('channel');
  const environment = readMatchString('environment');
  const tenant = readMatchString('tenant');
  const cohort = readMatchString('cohort');

  const normalizedReference = normalizeAppRef({
    expose,
    name,
    ...(range === undefined ? {} : { range }),
    ...(channel === undefined ? {} : { channel }),
  });
  return Object.freeze({
    expose,
    name,
    ...(normalizedReference.range === undefined ? {} : { range: normalizedReference.range }),
    ...(normalizedReference.channel === undefined ? {} : { channel: normalizedReference.channel }),
    ...(environment === undefined ? {} : { environment }),
    ...(tenant === undefined ? {} : { tenant }),
    ...(cohort === undefined ? {} : { cohort }),
  });
}

function validateVersion(version: unknown, name: string): string | undefined {
  if (version === undefined) {
    return undefined;
  }
  if (typeof version !== 'string' || version.trim() === '' || version !== version.trim()) {
    configurationError(`Application "${name}" deployment version must be a trimmed string.`, {
      name,
      version,
    });
  }
  return version;
}

function snapshotMetadata(
  metadata: unknown,
  name: string,
): Readonly<Record<string, unknown>> | undefined {
  if (metadata === undefined) {
    return undefined;
  }
  if (!isRecord(metadata)) {
    configurationError(`Application "${name}" deployment metadata must be an object.`, { name });
  }
  return Object.freeze({ ...metadata });
}

function createRemote(deployment: RemoteDeployment): Remote {
  return {
    // Exactly one of these reaches the official runtime; assertModuleFederationSource enforces it.
    ...(deployment.entry === undefined
      ? { version: deployment.remoteVersion }
      : { entry: deployment.entry }),
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
    const normalizedName = normalizeApplicationName(name);
    applications[normalizedName] = Object.freeze(
      normalizeAppRef({ ...reference, name: normalizedName }),
    );
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

  for (const [configuredName, configured] of Object.entries(apps)) {
    const name = normalizeApplicationName(configuredName);
    const candidates: readonly StaticDeployment[] = Array.isArray(configured)
      ? configured
      : [configured as StaticDeployment];
    if (candidates.length === 0) {
      configurationError(`Application "${name}" must declare at least one deployment.`, { name });
    }
    for (const candidate of candidates) {
      assertOwnDeploymentFields(candidate, name);
      assertRemoteAddress(candidate, name);
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
      const version = validateVersion(candidate.version, name);
      const metadata = snapshotMetadata(candidate.metadata, name);
      resolutions.push({
        match: createDeploymentMatch(candidate, name, expose),
        resolve: {
          source: createSource(candidate),
          ...(version === undefined ? {} : { version }),
          ...(metadata === undefined ? {} : { metadata }),
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
  const adapterState: { current?: ModuleFederationAdapter } = {};
  const requireAdapter = (): ModuleFederationAdapter => {
    if (adapterState.current === undefined) {
      configurationError('The Module Federation adapter is not initialized.');
    }
    return adapterState.current;
  };
  const host = createFrontsHost<ModuleFederationSource, Services>({
    ...hostOptions,
    hostId: hostOptions.hostId ?? name,
    loader: {
      load: (resolved, context) => requireAdapter().load(resolved, context),
      preload: (resolved, context) => requireAdapter().preload?.(resolved, context),
    },
    resolver: configured.resolver,
  });
  const runtime =
    suppliedRuntime ??
    createInstance({
      ...runtimeOptions,
      name: runtimeName ?? name,
      remotes: [],
    });
  adapterState.current = createModuleFederationAdapter({ instance: runtime });

  return Object.freeze({
    applications: configured.applications,
    host,
    runtime,
  });
}
