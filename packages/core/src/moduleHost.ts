import type { FrontsAppModule, MaybePromise } from './app/index.js';
import type {
  ApplicationCatalog,
  ApplicationContractShape,
  HostComposition,
} from './composition.js';
import { FrontsError, frontsErrorCodes, throwIfAborted } from './errors.js';
import { createFrontsHost, type AppLoader, type FrontsHostOptions } from './host/index.js';
import {
  createStaticResolver,
  normalizeAppRef,
  type AppRef,
  type AppResolver,
  type StaticResolution,
} from './resolver/index.js';

/**
 * Resolved source for an application the caller can already obtain.
 *
 * A module map needs no transport source of its own, so the logical application name is the only
 * routing key the synthesized loader requires.
 */
export interface AppModuleSource {
  readonly module: string;
}

/**
 * Returns the application module.
 *
 * A bundler-resolved `import()` is the expected form, including one that resolves to a Module
 * Federation remote the producer's official plugin already wired at build time.
 */
export type AppModuleImport = () => MaybePromise<FrontsAppModule<never, never>>;

export interface AppModuleDeployment {
  readonly load: AppModuleImport;
  /** Defaults to "./application". Recorded so bindings keep one reference per logical name. */
  readonly expose?: `./${string}`;
  /** Immutable deployment version used by Fronts identity, audit, and conflict detection. */
  readonly version?: string;
  /** Deployment data exposed to container resolvers, policy, and observability. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type AppModuleEntry = AppModuleImport | AppModuleDeployment;

export type AppModuleMap = Readonly<Record<string, AppModuleEntry>>;

type AppModuleImportOf<Entry> = Entry extends AppModuleDeployment ? Entry['load'] : Entry;

// Resolved without intersecting `AppModuleImport`: an intersection of two call signatures is an
// overload set, and `ReturnType` would read the declared one and infer `never` for every module.
type AppModuleResultOf<Entry> =
  AppModuleImportOf<Entry> extends (...args: never[]) => infer Result ? Awaited<Result> : never;

// `never` is the widest service contract to match against: `ServiceKey<never>` is `string`, so an
// application declaring concrete capabilities still matches while `Props` stays inferable.
type AppModulePropsOf<Entry> =
  AppModuleResultOf<Entry> extends FrontsAppModule<infer Props, never> ? Props : unknown;

/**
 * Props contracts inferred from the applications themselves.
 *
 * The application already declares its props through `defineApp`, so a shell that imports the
 * module directly has no second source of truth to keep in sync. An application that declares no
 * props widens to `object` because every contract value must stay object-shaped.
 */
export type ModuleContracts<Modules extends AppModuleMap> = {
  readonly [Name in keyof Modules]-?: AppModulePropsOf<Modules[Name]> extends object
    ? AppModulePropsOf<Modules[Name]>
    : object;
};

export interface ModuleHostOptions<
  Modules extends AppModuleMap,
  Services extends object,
> extends Omit<FrontsHostOptions<AppModuleSource, Services>, 'loader' | 'resolver'> {
  /** Fronts host identity and the default hostId. */
  readonly name: string;
  /** One module loader per logical application name. */
  readonly apps: Modules;
}

export type ModuleHostResult<
  Modules extends AppModuleMap,
  Services extends object,
> = HostComposition<
  ModuleContracts<Modules> extends ApplicationContractShape<ModuleContracts<Modules>>
    ? ModuleContracts<Modules>
    : never,
  AppModuleSource,
  Services
>;

function configurationError(message: string, details?: Readonly<Record<string, unknown>>): never {
  throw new FrontsError(frontsErrorCodes.resolutionFailed, message, {
    ...(details === undefined ? {} : { details }),
    phase: 'resolve',
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const moduleFields = [
  'expose',
  'load',
  'metadata',
  'version',
] as const satisfies readonly (keyof AppModuleDeployment)[];

// Compile-time completeness guard. `satisfies` above rejects a typo or an extra name; this rejects
// a new AppModuleDeployment field that was added without also guarding it here. The annotation
// names the missing field, so a drift failure reads as the field it forgot.
type UnguardedModuleField = Exclude<keyof AppModuleDeployment, (typeof moduleFields)[number]>;
const moduleFieldsAreExhaustive: [UnguardedModuleField] extends [never]
  ? true
  : UnguardedModuleField = true;
void moduleFieldsAreExhaustive;

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

function normalizeDeployment(entry: unknown, name: string): AppModuleDeployment {
  if (typeof entry === 'function') {
    return { load: entry as AppModuleImport };
  }
  if (!isRecord(entry)) {
    configurationError(`Application "${name}" must declare a module loader.`, { name });
  }
  for (const field of moduleFields) {
    if (field in entry && !Object.hasOwn(entry, field)) {
      configurationError(`Application "${name}" module field "${field}" must be an own property.`, {
        field,
        name,
      });
    }
  }
  if (typeof entry.load !== 'function') {
    configurationError(`Application "${name}" module loader must be a function.`, { name });
  }
  return entry as unknown as AppModuleDeployment;
}

function validateExpose(expose: unknown, name: string): string | undefined {
  if (expose === undefined) {
    return undefined;
  }
  if (typeof expose !== 'string') {
    configurationError(`Application "${name}" module expose must be a string.`, { name });
  }
  return expose;
}

function validateVersion(version: unknown, name: string): string | undefined {
  if (version === undefined) {
    return undefined;
  }
  if (typeof version !== 'string' || version.trim() === '' || version !== version.trim()) {
    configurationError(`Application "${name}" module version must be a trimmed string.`, {
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
    configurationError(`Application "${name}" module metadata must be an object.`, { name });
  }
  return Object.freeze({ ...metadata });
}

function createModuleLoader(
  modules: ReadonlyMap<string, AppModuleImport>,
): AppLoader<AppModuleSource> {
  const requireImport = (module: string): AppModuleImport => {
    const load = modules.get(module);
    if (load === undefined) {
      throw new FrontsError(
        frontsErrorCodes.loadFailed,
        `No application module is registered for "${module}".`,
        { details: { module }, phase: 'load' },
      );
    }
    return load;
  };
  return {
    async load(resolved, context) {
      throwIfAborted(context.signal, 'load');
      const module = await requireImport(resolved.source.module)();
      throwIfAborted(context.signal, 'load');
      return module;
    },
    async preload(resolved, context) {
      throwIfAborted(context.signal, 'load');
      // Evaluating the module is the whole optimization: the bundler chunk and its shared graph are
      // warmed, and the host does not create a service scope or claim a container.
      await requireImport(resolved.source.module)();
      throwIfAborted(context.signal, 'load');
    },
  };
}

function createStaticConfiguration(apps: AppModuleMap): {
  readonly applications: Readonly<Record<string, Readonly<AppRef>>>;
  readonly loader: AppLoader<AppModuleSource>;
  readonly resolver: AppResolver<AppModuleSource>;
} {
  const applications: Record<string, Readonly<AppRef>> = Object.create(null) as Record<
    string,
    Readonly<AppRef>
  >;
  const modules = new Map<string, AppModuleImport>();
  const resolutions: StaticResolution<AppModuleSource>[] = [];

  for (const [configuredName, configured] of Object.entries(apps)) {
    const name = normalizeApplicationName(configuredName);
    const deployment = normalizeDeployment(configured, name);
    const declaredExpose = validateExpose(deployment.expose, name);
    const version = validateVersion(deployment.version, name);
    const metadata = snapshotMetadata(deployment.metadata, name);
    const reference = normalizeAppRef({
      name,
      ...(declaredExpose === undefined ? {} : { expose: declaredExpose }),
    });

    applications[name] = Object.freeze(reference);
    modules.set(name, deployment.load);
    resolutions.push({
      match: Object.freeze({ expose: reference.expose, name }),
      resolve: {
        source: Object.freeze({ module: name }),
        ...(version === undefined ? {} : { version }),
        ...(metadata === undefined ? {} : { metadata }),
      },
    });
  }

  return {
    applications: Object.freeze(applications),
    loader: createModuleLoader(modules),
    resolver: createStaticResolver(resolutions),
  };
}

/**
 * Composes a Host over application modules the caller already knows how to import.
 *
 * This is the shortcut for delivery a bundler has already resolved. It owns no transport policy:
 * there is no registry, deployment candidate, or version selection, because a module map has
 * already made that decision at build time. Everything below the composition root is unchanged, so
 * the state machine, capability scoping, containers, replacement, cancellation, and leak audit
 * behave exactly as they do for any other Host.
 *
 * Use `createMfHost()` when deployments must be selected at runtime, or supply an explicit
 * `resolver` and `loader` to `createFrontsHost()` when policy is caller-owned.
 */
export function createModuleHost<Modules extends AppModuleMap, Services extends object = object>(
  options: ModuleHostOptions<Modules, Services>,
): ModuleHostResult<Modules, Services> {
  const { apps, name, ...hostOptions } = options;
  if (!isRecord(apps)) {
    configurationError('A module host requires an application module map.');
  }
  const configured = createStaticConfiguration(apps);
  const host = createFrontsHost<AppModuleSource, Services>({
    ...hostOptions,
    hostId: hostOptions.hostId ?? name,
    loader: configured.loader,
    resolver: configured.resolver,
  });

  return Object.freeze({
    applications: configured.applications as ApplicationCatalog<never>,
    host,
  }) as ModuleHostResult<Modules, Services>;
}
