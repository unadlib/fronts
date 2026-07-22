---
type: feature-spec
title: Composition shortcuts for React and Module Federation
description: Proposed high-level factories that shorten the common React plus Module Federation composition root without weakening the Fronts host contract.
owner: unadlib/fronts maintainers
status: proposed
tags: [api, react, module-federation, composition]
---

# Composition shortcuts for React and Module Federation

Status: proposed. Nothing in this document is implemented yet.

## Decision

Add an optional `@fronts/react-mf` package that provides a high-level React + Module Federation
preset. Keep `@fronts/core`, `@fronts/mf`, and `@fronts/react` unchanged as the composable low-level
API.

The common path should require one stateful shell and one ordinary React component:

```tsx
const mfe = createReactMfe({
  name: 'shop-shell',
  apps: {
    checkout: defineRemote<CheckoutProps>({
      remote: 'checkout_remote',
      entry: 'https://cdn.example.com/checkout/mf-manifest.json',
    }),
  },
});

const Checkout = mfe.component('checkout');

<Checkout cartId="C-42" />;
```

The preset is a facade over the current public APIs. It must not introduce another Module
Federation runtime, bundler plugin, application protocol, or process-wide singleton.

## Design principles

1. **Progressive disclosure** — the fixed-remote React case is short; policy and lifecycle controls
   remain available when needed.
2. **Ordinary React semantics** — applications are rendered as components. A Hook must not return a
   component type.
3. **No hidden singleton** — the facade never calls the global `init()`/`getInstance()` API. It
   either receives a runtime explicitly or creates a dedicated official instance with
   `createInstance()`.
4. **Configuration at the composition root** — deployment configuration does not live inside a
   component render or an inline loader callback.
5. **Explicit ownership** — the shell owns and disposes the `FrontsHost` it creates. It does not
   pretend to destroy Module Federation runtime state that has no matching public destroy API.
   `dispose()` is idempotent.
6. **Preserve the current contracts** — readiness, prop updates, cancellation, service scopes,
   containers, errors, replacement, and audit continue to use the existing Fronts implementation.
7. **No new build abstraction** — producers still use an official Module Federation plugin. The
   preset only composes the official runtime API at run time.

## Quick start

### Remote producer

The producer API is already concise and should remain unchanged:

```tsx
import { defineReactApp } from '@fronts/react';

export interface CheckoutProps {
  readonly cartId: string;
}

function Checkout({ cartId }: CheckoutProps) {
  return <h2>Cart {cartId}</h2>;
}

export default defineReactApp<CheckoutProps>({
  name: 'checkout',
  root: Checkout,
});
```

The bundler exposes this module as `./application`. Fronts continues to delegate manifests,
chunks, shared dependencies, and remote types to official Module Federation tooling.

### React host

```tsx
import { createRoot } from 'react-dom/client';
import { createReactMfe, defineRemote } from '@fronts/react-mf';

import type { CheckoutProps } from './contracts.js';

const mfe = createReactMfe({
  name: 'shop-shell',
  apps: {
    checkout: defineRemote<CheckoutProps>({
      remote: 'checkout_remote',
      entry: 'https://cdn.example.com/checkout/mf-manifest.json',
    }),
  },
});

const Checkout = mfe.component('checkout', {
  loading: <p>Loading checkout…</p>,
  fallback: ({ error, retry }) => (
    <section role="alert">
      <p>{error.message}</p>
      <button onClick={retry}>Retry</button>
    </section>
  ),
});

function App() {
  return <Checkout cartId="C-42" />;
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

window.addEventListener(
  'beforeunload',
  () => {
    root.unmount();
    void mfe.dispose();
  },
  { once: true },
);
```

`mfe.component()` is a factory called outside render. It returns a stable component whose public
props are exactly the remote application's props. Loading, error, selection, and container options
are bound separately, so they cannot collide with application prop names.

## Inline form

When application selection or container options vary per render, use the bound `mfe.App` component:

```tsx
<mfe.App
  app="checkout"
  props={{ cartId: 'C-42' }}
  container="shadow"
  loading={<p>Loading…</p>}
  fallback={({ error, retry }) => <button onClick={retry}>Retry after: {error.message}</button>}
/>
```

The two rendering forms are equivalent:

```tsx
const Checkout = mfe.component('checkout', defaults);
<Checkout cartId="C-42" />;

// Equivalent low-ceremony inline form:
<mfe.App app="checkout" props={{ cartId: 'C-42' }} {...defaults} />;
```

## Proposed public API

### `defineRemote()`

`defineRemote()` creates a typed, immutable static deployment descriptor. Its generic parameters
are compile-time only.

```ts
interface DefineRemoteOptions {
  /** Official Module Federation remote name. */
  readonly remote: string;

  /** Manifest or remote entry accepted by the official runtime. */
  readonly entry: string;

  /** Required for raw entries whose format cannot be inferred from a manifest. */
  readonly type?: RemoteEntryType;

  readonly entryGlobalName?: string;
  readonly shareScope?: string | readonly string[];

  /** Defaults to "./application". */
  readonly expose?: `./${string}`;

  /** Optional immutable deployment version used by Fronts identity and audit output. */
  readonly version?: string;

  /** Passed to the existing @fronts/mf adapter. */
  readonly force?: boolean;
}

interface RemoteDefinition<
  Props extends object,
  Services extends object = object,
> extends DefineRemoteOptions {
  /** Type-only fields; not emitted at run time. */
  readonly __props?: Props;
  readonly __services?: Services;
}

declare function defineRemote<
  Props extends object = Record<string, never>,
  Services extends object = object,
>(options: DefineRemoteOptions): RemoteDefinition<Props, Services>;
```

The logical application name is the key in `apps`; it is deliberately separate from the Module
Federation remote name:

```ts
apps: {
  checkout: defineRemote<CheckoutProps>({
    remote: 'checkout_2026_07_22',
    entry: 'https://cdn.example.com/checkout/mf-manifest.json',
  }),
}
```

This retains the existing distinction between `AppRef` and a concrete deployment.

The static helper deliberately requires a concrete `entry`. Its `version` is the resolved Fronts
deployment version, not Module Federation's version-only remote lookup. A registry or snapshot
workflow belongs in the dynamic resolver overload, where it can make an explicit immutable
deployment decision.

The optional second generic describes the services required by that remote. The static shell type
checks that its host service surface satisfies every descriptor; it is not decorative type
metadata.

### `createReactMfe()`

```ts
type RemoteMap = Readonly<Record<string, RemoteDefinition<object, object>>>;

type PropsOf<Definition> = Definition extends RemoteDefinition<infer Props, object> ? Props : never;

type ContractsOf<Apps extends RemoteMap> = {
  readonly [Name in keyof Apps]: PropsOf<Apps[Name]>;
};

type RequiredServicesOf<Definition> =
  Definition extends RemoteDefinition<object, infer Services> ? Services : never;

type CompatibleRemoteMap<Apps extends RemoteMap, Services extends object> = {
  readonly [Name in keyof Apps]: Services extends RequiredServicesOf<Apps[Name]>
    ? Apps[Name]
    : never;
};

type RuntimeConfiguration =
  | {
      /** Existing official runtime instance; its lifecycle remains caller-owned. */
      readonly runtime: ModuleFederation;
      readonly runtimeOptions?: never;
    }
  | {
      readonly runtime?: never;
      /** Forwarded to createInstance(); name and remotes remain facade-owned. */
      readonly runtimeOptions?: Omit<UserOptions, 'name' | 'remotes'>;
    };

type ReactMfeHostOptions<Services extends object> = Omit<
  FrontsHostOptions<ModuleFederationSource, Services>,
  'loader' | 'resolver'
> & {
  /** Host identity and default official runtime instance name. */
  readonly name: string;
};

type CreateReactMfeOptions<
  Apps extends RemoteMap,
  Services extends object,
> = ReactMfeHostOptions<Services> &
  RuntimeConfiguration & {
    /** Static convenience map compiled to createStaticResolver(). */
    readonly apps: Apps & CompatibleRemoteMap<Apps, Services>;
  };

declare function createReactMfe<Apps extends RemoteMap, Services extends object = object>(
  options: CreateReactMfeOptions<Apps, Services>,
): ReactMfeShell<ContractsOf<Apps>, Services>;
```

The implementation is intentionally mechanical:

```text
createInstance({ ...runtimeOptions, name, remotes: [] }) when runtime is omitted
createModuleFederationSource()          once per static app
createStaticResolver()                  from the apps map
createModuleFederationAdapter()         with the official runtime instance
createFrontsHost()                      with services and policies
RemoteApp                               behind the bound React facade
```

The facade does not duplicate any of these implementations.

`runtime` and `runtimeOptions` are mutually exclusive. The short path creates a dedicated official
runtime, while `runtimeOptions` preserves official configuration such as shared modules, runtime
plugins, and share strategy. If a build integration or a larger shell already owns an official
runtime instance, pass it through `runtime`; the facade never discovers one from global state.

The official `createInstance()` implementation may retain instances in its own global registry and
does not expose a matching destroy operation. Create a shell once per composition root. For HMR or
frequently recreated roots, inject a longer-lived runtime instead of repeatedly asking the facade
to create one.

All existing `FrontsHostOptions` except `resolver` and `loader` pass through unchanged. That keeps
custom containers, iframe loaders, deterministic ID factories, service providers, policy,
observers, and test clocks available without mirroring their definitions in the facade. `hostId`
defaults to `name` when the caller does not provide it.

### `mfe.App`

```ts
type ContractShape<Contracts extends object> = {
  readonly [Name in keyof Contracts]: object;
};

type AppName<Contracts extends ContractShape<Contracts>> = Extract<keyof Contracts, string>;

interface Selection {
  /** AppRef fields. */
  readonly range?: string;
  readonly channel?: string;

  /** Resolution policy fields. */
  readonly environment?: string;
  readonly tenant?: string;
  readonly cohort?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

type ContainerOption<Source> =
  'dom' | 'shadow' | ContainerRequest | ContainerRequestResolver<Source, ContainerRequest>;

interface RemoteFailure {
  readonly error: Error;
  /** Starts a new mount attempt with a new operation identity. */
  readonly retry: () => void;
}

interface AppControls<Props, Source> {
  readonly selection?: Selection;
  readonly container?: ContainerOption<Source>;
  readonly instanceId?: string;
  readonly traceId?: string;
  readonly readyTimeoutMs?: number;
  readonly loading?: ReactNode;
  readonly fallback?: ReactNode | ((failure: RemoteFailure) => ReactNode);
  readonly onReady?: (application: MountedApplication<Props, Source>) => void;
  readonly onError?: (error: Error) => void;
  readonly targetProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'ref'>;
  readonly wrapperProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children'>;
}

type BoundAppProps<
  Contracts extends ContractShape<Contracts>,
  Name extends AppName<Contracts>,
  Source,
> = AppControls<Contracts[Name], Source> & {
  readonly app: Name;
  readonly props: Contracts[Name];
};

type ReactMfeComponent<Contracts extends ContractShape<Contracts>> = <
  Name extends AppName<Contracts>,
>(
  props: BoundAppProps<Contracts, Name, ModuleFederationSource>,
) => ReactElement | null;
```

`selection` is a facade-only convenience. Internally, `range` and `channel` become `AppRef` fields;
the remaining fields become `ResolveContext` policy inputs. The low-level API remains unchanged.
The fixed `apps` map always resolves to its one declared deployment; use the dynamic overload when
selection must route to a different version or environment.

String container shorthands map to existing requests:

```ts
'dom' satisfies ContainerOption<unknown>; // { type: 'dom' }
'shadow' satisfies ContainerOption<unknown>; // { type: 'shadow', mode: 'open' }
```

An iframe still requires an explicit request or resolver because `src`, `targetOrigin`, sandbox
flags, and loader placement are security decisions and should never be guessed by a convenience
API.

### `mfe.component()`

```ts
type ComponentDefaults<Props, Source> = Omit<AppControls<Props, Source>, 'instanceId'>;

interface ReactMfeShell<Contracts extends ContractShape<Contracts>, Services extends object> {
  component<Name extends AppName<Contracts>>(
    name: Name,
    defaults?: ComponentDefaults<Contracts[Name], ModuleFederationSource>,
  ): ComponentType<Contracts[Name]>;
}
```

Important semantics:

- It is a normal factory, not a Hook.
- It should be called once at module scope or otherwise memoized by the caller.
- The returned component has a stable type and accepts only application props.
- Changing those props calls the existing `MountedApplication.update()` path; it does not remount by
  default.
- React's ordinary `key` can be used when the caller intentionally wants a new instance.
- Defaults are captured when the component type is created. Use `mfe.App` for per-instance control
  options.
- `instanceId` is intentionally excluded from component defaults because one component type may be
  rendered more than once. Use the inline form when an external identity is required.

### Shell methods and escape hatches

```ts
interface ReactMfeShell<Contracts extends ContractShape<Contracts>, Services extends object> {
  readonly App: ReactMfeComponent<Contracts>;

  /** Stable component factory. */
  component<Name extends AppName<Contracts>>(
    name: Name,
    defaults?: ComponentDefaults<Contracts[Name], ModuleFederationSource>,
  ): ComponentType<Contracts[Name]>;

  /** Uses the same resolver and loader path as a later mount. */
  preload<Name extends AppName<Contracts>>(
    app: Name,
    options?: { readonly selection?: Selection; readonly traceId?: string },
  ): Promise<void>;

  /** Idempotently unmounts applications and disposes the owned host. */
  dispose(): Promise<void>;

  /** Advanced public escape hatches; never hidden in module globals. */
  readonly host: FrontsHost<ModuleFederationSource, Services>;
  readonly runtime: ModuleFederation;
}
```

Advanced users can use `mfe.host.resolve()`, `mfe.host.replace()`, `mfe.host.inspect()`, or
`mfe.host.audit()` without abandoning the preset. `dispose()` never attempts to destroy the Module
Federation runtime—created or injected—because the official public API has no such lifecycle
operation.

## Dynamic deployment policy

The static `apps` map covers the common case. A registry-backed platform can provide the existing
resolver instead:

```tsx
type AppContracts = {
  readonly checkout: CheckoutProps;
  readonly account: AccountProps;
};

const mfe = createReactMfe<AppContracts, HostServices>({
  name: 'shop-shell',
  runtime,
  resolver: registryResolver,
  services,
  capabilityPolicy,
});

<mfe.App
  app="checkout"
  props={{ cartId: 'C-42' }}
  selection={{ tenant: 'acme', cohort: 'beta', channel: 'canary' }}
/>;
```

This is a second overload rather than a new resolver abstraction:

```ts
type DynamicReactMfeOptions<Services extends object> = ReactMfeHostOptions<Services> &
  RuntimeConfiguration & {
    readonly resolver: AppResolver<ModuleFederationSource>;
  };

declare function createReactMfe<
  Contracts extends ContractShape<Contracts>,
  Services extends object = object,
>(options: DynamicReactMfeOptions<Services>): ReactMfeShell<Contracts, Services>;
```

The overload only binds application names to prop types. The supplied resolver remains responsible
for versions, entries, policy, caching, and immutable deployment decisions.

## Host services

The facade should preserve capability scoping instead of replacing it with an ambient event bus:

```tsx
interface HostServices {
  readonly navigation: { go(path: string): void };
  readonly telemetry: { emit(name: string, data?: unknown): void };
}

const mfe = createReactMfe({
  name: 'shop-shell',
  apps: {
    checkout: defineRemote<CheckoutProps, HostServices>({
      remote: 'checkout_remote',
      entry: 'https://cdn.example.com/checkout/mf-manifest.json',
    }),
  },
  services: {
    navigation: { go: (path) => history.pushState(null, '', path) },
    telemetry: { emit: (name, data) => console.info(name, data) },
  },
  capabilityPolicy: ({ capability, identity }) =>
    capability !== 'navigation' || identity.name === 'checkout',
});
```

The remote still declares the services it needs:

```tsx
export default defineReactApp<CheckoutProps, HostServices>({
  name: 'checkout',
  capabilities: ['navigation', 'telemetry'],
  root: Checkout,
});
```

The preset passes these options to `createFrontsHost()`; authorization and revocation continue to
belong to core.

## Lifecycle semantics

The facade must not weaken the existing lifecycle contract:

1. Rendering `mfe.App` starts resolution, loading, container preparation, mount, and readiness.
2. `loading` remains visible until the remote React tree commits its initial usable render.
3. A changed `props` object calls `update()` on the retained application instance.
4. Unmounting the React wrapper aborts pending work and then unmounts the application.
5. `retry()` creates a fresh operation; it never resumes a partially failed mount.
6. A render failure reaches `fallback` and `onError` with the real error.
7. `mfe.dispose()` rejects new operations, aborts pending work, unmounts retained instances, and
   remains safe when called more than once.
8. Replacement, activation, deactivation, inspection, and audit remain available through
   `mfe.host` rather than expanding the common component props.

## Error handling

The preset should keep the simple React surface while retaining phase information:

```tsx
const Checkout = mfe.component('checkout', {
  fallback: ({ error, retry }) => {
    const phase = error instanceof FrontsError ? error.phase : undefined;
    return (
      <ErrorPanel
        title={phase === undefined ? 'Checkout failed' : `Checkout failed during ${phase}`}
        retry={retry}
      />
    );
  },
});
```

The facade must not log errors automatically. Applications decide how errors are displayed; the
host observer decides how they are reported.

## Why this is preferable to `useApp({ loader })`

The proposal keeps the desirable short call site without copying the problematic parts of that
shape:

- A normal component is easier to understand than a Hook returning a component.
- Remote configuration is created once, not on every render.
- Component identity is stable.
- Props have explicit update semantics rather than being captured only for the initial mount.
- Loading failures preserve their error and phase.
- Unmount can cancel pending resolution and loading.
- There is no import-order flag deciding whether a remote auto-renders.
- There is no implicit runtime shared by unrelated React roots.
- Deployment policy stays outside presentation code.

## Package boundaries

```text
@fronts/core         framework- and transport-neutral contracts
@fronts/mf           official Module Federation runtime adapter
@fronts/react        React producer and low-level host bindings
@fronts/react-mf     optional preset that composes the three packages above
```

`@fronts/react-mf` may accept a slightly larger dependency and bundle budget in exchange for the
cohesive API. That cost must not leak into users of `@fronts/core`, another transport, Vue, or a
headless host.

A future `@fronts/vue3-mf` could expose the same shell configuration with Vue bindings, but it
should share only internal composition utilities—not force a framework abstraction into core.

## Non-goals

The preset does not:

- create a Fronts-specific bundler plugin;
- parse or rewrite Module Federation manifests;
- resolve shared dependency versions;
- discover a runtime through a mutable process-wide variable;
- fetch a registry unless the caller supplies a resolver that does so;
- infer iframe origins or sandbox flags;
- replace the low-level `FrontsHost` API;
- turn Fronts into a router or server-side rendering framework.

## Compatibility and implementation path

This proposal can be implemented without changing the current core contracts:

1. Add `@fronts/react-mf` as a new optional package.
2. Implement `defineRemote()` as validation plus a frozen descriptor.
3. Implement `createReactMfe()` by composing only current public package exports.
4. Implement `mfe.App` on top of the existing `RemoteApp`/`useRemoteApp` behavior.
5. Implement `mfe.component()` as a stable component factory around `mfe.App`.
6. Keep `mfe.host` and `mfe.runtime` public as escape hatches.
7. Do not deprecate `createFrontsHost()`, `createModuleFederationAdapter()`, or `RemoteApp`.

Existing code remains valid. A current host can migrate incrementally by replacing only its static
composition root; producers require no change.

## Acceptance criteria

The API is successful only if all of the following hold:

- A fixed React remote can be configured and rendered with `createReactMfe()`, `defineRemote()`, and
  one JSX element.
- No mutable singleton or import-order behavior is introduced.
- Prop changes use the existing update lifecycle and do not remount by default.
- Unmount and retry remain cancellation-safe.
- Static app names infer their exact prop types.
- A custom resolver, service provider, capability policy, observer, and official runtime instance
  remain supported.
- DOM and Shadow DOM retain concise forms; iframe configuration stays explicit.
- `mfe.host` exposes replacement, inspection, and audit without duplicating them.
- The preset passes the same real Module Federation runtime integration and lifecycle contract tests
  as the low-level composition.
- Consumers that do not install the preset pay no dependency or bundle-size cost for it.

## Verification

Verification: Missing. No part of this proposal is implemented, so there is no executable evidence
yet. Accepting it requires, at minimum:

- contract tests that run the shortcuts against the same real Module Federation runtime integration
  as the low-level composition;
- type-level tests for the application name to prop contract correlation;
- an example that exercises the shortcuts end to end in both browser E2E modes.

## Final recommendation

Keep `defineReactApp()` as the producer API. Add `createReactMfe()`, `defineRemote()`, `mfe.App`, and
`mfe.component()` as an optional high-level host facade.

This gives the common React + Module Federation path the brevity users expect while preserving the
explicit, testable, policy-aware runtime underneath. The complexity still exists where the product
needs it, but ordinary users no longer have to assemble it by hand.
