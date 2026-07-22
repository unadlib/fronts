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

Add two independent factories rather than one fused preset:

- `createMfHost()` in `@fronts/mf` builds a `FrontsHost` over the official Module Federation
  runtime. It is framework-neutral.
- `createReactBindings()` in `@fronts/react` binds any `FrontsHost` to React components. It is
  transport-neutral.

Neither package gains a dependency on the other, and no new package is introduced.

```tsx
const { host } = createMfHost<ShopContracts>({
  name: 'shop-shell',
  apps: {
    checkout: {
      remote: 'checkout_remote',
      entry: 'https://cdn.example.com/checkout/mf-manifest.json',
    },
  },
});

const { component } = createReactBindings<ShopContracts>(host);
const Checkout = component('checkout');

<Checkout cartId="C-42" />;
```

These are shortcuts over the current public API. They must not introduce another Module Federation
runtime, bundler plugin, application protocol, or process-wide singleton.

## Why not the official Bridge

[The decision record](decision-record.md) routes "React remote, official Bridge already satisfies
routing and rendering" and "single framework, one trust domain, fixed remote address" away from
Fronts. A shortcut whose showcase is exactly that case argues against its own product.

So the shortcuts are not positioned as a faster way to render a remote React component. They exist
so that a shell which genuinely needs the Fronts host — capability-scoped services, container
isolation, resolution policy, readiness-gated replacement, leak audit — does not pay composition
ceremony for the parts it is not yet using. Every example below therefore carries at least one
capability the official Bridge does not own.

A shell that needs none of them should use `@module-federation/bridge-react` and not Fronts.

## Design principles

1. **One concern per factory** — transport composition and framework binding are independent, and
   the packaging follows that split rather than fusing them.
2. **Contracts outlive deployments** — the prop contract of an application is declared once and does
   not move when its CDN address, channel, or resolver changes.
3. **Ordinary React semantics** — applications are rendered as components. A Hook must not return a
   component type.
4. **No hidden singleton** — the factories never call the global `init()`/`getInstance()` API. They
   either receive a runtime explicitly or create a dedicated instance with `createInstance()`.
5. **Configuration at the composition root** — deployment configuration does not live inside a
   component render or an inline loader callback.
6. **Preserve the current contracts** — readiness, prop updates, cancellation, service scopes,
   containers, errors, replacement, and audit continue to use the existing Fronts implementation.
7. **No new build abstraction** — producers still use an official Module Federation plugin. The
   shortcuts only compose the official runtime API at run time.

## Quick start

### Remote producer

The producer API is already concise and remains unchanged:

```tsx
import { defineReactApp } from '@fronts/react';

export interface CheckoutProps {
  readonly cartId: string;
}

function Checkout({ cartId }: CheckoutProps) {
  return <h2>Cart {cartId}</h2>;
}

export default defineReactApp<CheckoutProps, HostServices>({
  name: 'checkout',
  capabilities: ['navigation', 'telemetry'],
  root: Checkout,
});
```

The bundler exposes this module as `./application`. Fronts continues to delegate manifests, chunks,
shared dependencies, and remote types to official Module Federation tooling.

### Application contracts

Contracts are a plain type map from logical application name to props. They are declared once, by
the team that owns the shell's integration surface, and are independent of where any application is
deployed:

```ts
export interface ShopContracts {
  readonly checkout: CheckoutProps;
  readonly account: AccountProps;
}
```

Derive each entry from the remote types that Module Federation's type plugin already generates
rather than hand-writing a second copy:

```ts
import type { CheckoutProps } from 'checkout_remote/application';
```

A hand-written contract is an assertion about a remote the shell has not loaded. Deriving it from
generated remote types makes the assertion checkable at build time.

### React host

```tsx
import { createRoot } from 'react-dom/client';
import { createMfHost } from '@fronts/mf';
import { createReactBindings } from '@fronts/react';

import type { ShopContracts } from './contracts.js';

const { host } = createMfHost<ShopContracts, HostServices>({
  name: 'shop-shell',
  apps: {
    checkout: {
      remote: 'checkout_remote',
      entry: 'https://cdn.example.com/checkout/mf-manifest.json',
      version: '2.4.1',
    },
    account: {
      remote: 'account_remote',
      entry: 'https://cdn.example.com/account/mf-manifest.json',
      version: '5.1.0',
    },
  },
  services: {
    navigation: { go: (path) => history.pushState(null, '', path) },
    telemetry: { emit: (name, data) => console.info(name, data) },
  },
  capabilityPolicy: ({ capability, identity }) =>
    capability !== 'navigation' || identity.name === 'checkout',
});

const { App, component } = createReactBindings<ShopContracts>(host);

const Checkout = component('checkout', {
  loading: <p>Loading checkout…</p>,
  fallback: ({ error, retry }) => (
    <section role="alert">
      <p>{error.message}</p>
      <button onClick={retry}>Retry</button>
    </section>
  ),
});

function Shop() {
  return <Checkout cartId="C-42" />;
}

const root = createRoot(document.getElementById('root')!);
root.render(<Shop />);

window.addEventListener(
  'beforeunload',
  () => {
    root.unmount();
    void host.dispose();
  },
  { once: true },
);
```

`component()` is a factory called outside render. It returns a stable component whose public props
are exactly the application's props. Loading, error, container, and selection options are bound
separately, so they cannot collide with application prop names.

## Proposed public API

### `createMfHost()`

```ts
interface RemoteDeployment {
  /** Official Module Federation remote name. */
  readonly remote: string;

  /** Manifest or remote entry accepted by the official runtime. */
  readonly entry: string;

  /** Required for raw entries whose format cannot be inferred from a manifest. */
  readonly type?: Remote['type'];

  readonly alias?: string;
  readonly entryGlobalName?: string;
  readonly shareScope?: string | readonly string[];

  /** Defaults to "./application". */
  readonly expose?: `./${string}`;

  /** Immutable deployment version used by Fronts identity, audit, and conflict detection. */
  readonly version?: string;

  /** Passed to the existing @fronts/mf adapter. */
  readonly force?: boolean;
  readonly preload?: ModuleFederationSource['preload'];
}

/** Mirrors the selector fields createStaticResolver() already matches on. */
interface DeploymentMatch {
  readonly range?: string;
  readonly channel?: string;
  readonly environment?: string;
  readonly tenant?: string;
  readonly cohort?: string;
}

type StaticDeployments<Contracts extends object> = {
  readonly [Name in keyof Contracts]:
    RemoteDeployment | readonly (RemoteDeployment & { readonly match?: DeploymentMatch })[];
};

type RuntimeConfiguration =
  | {
      /** Existing official runtime instance; its lifecycle remains caller-owned. */
      readonly runtime: ModuleFederation;
      readonly runtimeOptions?: never;
      readonly runtimeName?: never;
    }
  | {
      readonly runtime?: never;
      /** Forwarded to createInstance(); remotes remain factory-owned. */
      readonly runtimeOptions?: Omit<UserOptions, 'name' | 'remotes'>;
      /** Official runtime instance name. Defaults to `name`. */
      readonly runtimeName?: string;
    };

type MfHostOptions<Contracts extends object, Services extends object> = Omit<
  FrontsHostOptions<ModuleFederationSource, Services>,
  'loader' | 'resolver'
> &
  RuntimeConfiguration & {
    /** Host identity; also the default `hostId`. */
    readonly name: string;
  } & (
    | { readonly apps: StaticDeployments<Contracts>; readonly resolver?: never }
    | { readonly apps?: never; readonly resolver: AppResolver<ModuleFederationSource> }
  );

interface MfHostResult<Services extends object> {
  readonly host: FrontsHost<ModuleFederationSource, Services>;
  readonly runtime: ModuleFederation;
}

declare function createMfHost<Contracts extends object, Services extends object = object>(
  options: MfHostOptions<Contracts, Services>,
): MfHostResult<Services>;
```

`Contracts` constrains only the keys of the static `apps` map, so a missing or misspelled
application is a compile error. It carries no runtime meaning.

### Static deployments answer selection

An application maps either to one deployment or to an ordered list of candidates, each with the
selector fields `createStaticResolver()` already matches on. Candidates are evaluated in order and
the first match wins, so an entry without `match` acts as the default:

```ts
apps: {
  account: [
    { match: { channel: 'canary' }, remote: 'account_next', entry: '…', version: '6.0.0' },
    { remote: 'account_remote', entry: '…', version: '5.1.0' },
  ],
}
```

```tsx
<App app="account" props={{ accountId: 'A-1' }} selection={{ ref: { channel: 'canary' } }} />
```

Without the list form, `selection` would be a prop the static path accepts and discards. The
generated resolver would match on name alone, so every policy field would be ignored — and
`selection.ref` would be worse than ignored, because `range` and `channel` enter the normalized
application reference and therefore change instance identity. A shell that varied only those fields
would unmount and remount the application to arrive at the same deployment.

Selection remains a routing input, not a deployment declaration. A shell that needs versions chosen
by a registry, a snapshot, or an experiment service supplies a `resolver` instead; the static list
covers the case where the candidate set is known at build time and only the choice is dynamic.

The implementation is intentionally mechanical:

```text
createInstance({ ...runtimeOptions, name: runtimeName ?? name, remotes: [] }) when runtime is omitted
createModuleFederationSource()          once per static deployment
createStaticResolver()                  from the apps map
createModuleFederationAdapter()         with the official runtime instance
createFrontsHost()                      with services and policies
```

The factory does not duplicate any of these implementations. All `FrontsHostOptions` except
`resolver` and `loader` pass through unchanged, so custom containers, iframe loaders, deterministic
ID factories, service providers, policy, observers, and test clocks stay available without being
mirrored here. `hostId` defaults to `name`.

`name` and `runtimeName` are separate because they name different things. `name` is the Fronts host
identity that appears in events and audit output; `runtimeName` is the official Module Federation
instance name, which shares a namespace with build configuration and share scopes. The examples in
this repository already use different conventions for the two (`fronts-example-shell` against
`fronts_react_host`).

`apps` and `resolver` are mutually exclusive. A registry-backed platform supplies the existing
resolver and keeps full control of versions, entries, policy, caching, and immutable deployment
decisions:

```ts
const { host } = createMfHost<ShopContracts, HostServices>({
  name: 'shop-shell',
  runtime,
  resolver: registryResolver,
  services,
  capabilityPolicy,
});
```

Both forms produce the same `FrontsHost` and the same `Contracts` binding, so moving from a static
map to a registry changes the composition root only. No application code and no type declarations
move with it.

### `createReactBindings()`

```ts
type ContractShape<Contracts extends object> = {
  readonly [Name in keyof Contracts]: object;
};

type AppName<Contracts extends ContractShape<Contracts>> = Extract<keyof Contracts, string>;

interface Selection {
  /** Becomes AppRef fields, so it participates in instance identity and audit output. */
  readonly ref?: { readonly range?: string; readonly channel?: string };
  /** Becomes ResolveContext policy input; it never enters instance identity. */
  readonly resolve?: ResolutionPolicyContext;
}

type ContainerOption<Source, Request extends ContainerRequest = BuiltInContainerRequest> =
  'dom' | 'shadow' | Request | ContainerRequestResolver<Source, Request>;

interface AppControls<Props, Source, Request extends ContainerRequest> {
  readonly selection?: Selection;
  readonly container?: ContainerOption<Source, Request>;
  readonly instanceId?: string;
  readonly traceId?: string;
  readonly readyTimeoutMs?: number;
  readonly loading?: ReactNode;
  readonly fallback?: ReactNode | ((failure: RemoteFailure) => ReactNode);
  readonly arePropsEqual?: (previous: Props, next: Props) => boolean;
  readonly onReady?: (application: MountedApplication<Props, Source>) => void;
  readonly onError?: (error: Error) => void;
  readonly targetProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'ref'>;
  readonly wrapperProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children'>;
}

/** Distributed over application names so `app` and `props` stay correlated. */
type BoundAppProps<
  Contracts extends ContractShape<Contracts>,
  Source,
  Request extends ContainerRequest,
> = {
  [Name in AppName<Contracts>]: AppControls<Contracts[Name], Source, Request> & {
    readonly app: Name;
    readonly props: Contracts[Name];
  };
}[AppName<Contracts>];

type ReactAppComponent<Contracts extends ContractShape<Contracts>, Source> = <
  Request extends ContainerRequest = BuiltInContainerRequest,
>(
  props: BoundAppProps<Contracts, Source, Request>,
) => ReactElement | null;

type ComponentDefaults<Props, Source, Request extends ContainerRequest> = Omit<
  AppControls<Props, Source, Request>,
  'instanceId'
>;

interface PreloadOptions {
  readonly selection?: Selection;
  readonly traceId?: string;
}

interface ReactBindings<Contracts extends ContractShape<Contracts>, Source> {
  /** Inline form; use when the application or its control options vary per render. */
  readonly App: ReactAppComponent<Contracts, Source>;

  /** Stable component factory. */
  component<
    Name extends AppName<Contracts>,
    Request extends ContainerRequest = BuiltInContainerRequest,
  >(
    name: Name,
    defaults?: ComponentDefaults<Contracts[Name], Source, Request>,
  ): ComponentType<Contracts[Name]>;

  /** Uses the same resolver and loader path as a later mount. */
  preload<Name extends AppName<Contracts>>(app: Name, options?: PreloadOptions): Promise<void>;
}

declare function createReactBindings<Contracts extends ContractShape<Contracts>>(): <
  Source,
  Services extends object,
>(
  host: FrontsHost<Source, Services>,
) => ReactBindings<Contracts, Source>;
```

`Source` is inferred from the host, so the bindings work over a Module Federation host, an
iframe-only host, or any future transport without changing this signature. Nothing in
`@fronts/react` learns about Module Federation.

The bindings deliberately do not own the host. There is no `dispose()` here and no `runtime`
property, because the caller already holds both: `host.dispose()` and the `runtime` returned by
`createMfHost()`. Replacement, inspection, and audit likewise stay on `host` rather than being
mirrored onto a wrapper object.

### Why `BoundAppProps` is a distributed union

Declaring `App` as a function generic in the application name is the obvious encoding and it is
unsound. TypeScript infers the name parameter from the value supplied, so a union widens the
indexed access with it:

```tsx
declare const which: 'checkout' | 'account';

// With a generic Name parameter this compiles: Contracts[Name] widens to
// CheckoutProps | AccountProps, so checkout props satisfy an account mount.
<App app={which} props={{ cartId: 'C-42' }} />;
```

A union of per-name object types has no such widening step, so the same call is rejected. This is
the encoding that makes the "static application names infer their exact prop types" acceptance
criterion true rather than true only for literal names.

### Why `ContainerOption` is generic

`ContainerRequest` is the base contract and its only member is `type`. Constraining the option to
that base makes excess property checking reject every real request, including the built-in ones the
container documentation shows:

```tsx
// Rejected against the bare base: `mode` is an excess property.
<App app="checkout" props={{ cartId: 'C-42' }} container={{ type: 'shadow', mode: 'open' }} />
```

Defaulting the parameter to `BuiltInContainerRequest` keeps the DOM and Shadow DOM forms concise
while still admitting a custom request or resolver:

```tsx
<App<IframeContainerRequest> app="checkout" props={{ cartId: 'C-42' }} container={iframeResolver} />
```

An iframe still requires an explicit request or resolver, because `src`, `targetOrigin`, sandbox
flags, and loader placement are security decisions that a convenience API must never guess.

### Two rendering forms

`component()` is sugar over `App`, and both are kept for different reasons. `component()` produces a
`ComponentType<Props>`, which is what a router `element`, a design-system slot, or a lazy boundary
expects; `App` is the form to use when the application name or the control options vary per render.
Defaults are captured when the component type is created, so `App` remains the way to vary controls
per instance.

`instanceId` is excluded from component defaults because one component type may be rendered more
than once. Use the inline form when an external identity is required.

## Change detection

Every value the shortcuts accept is written inline at a call site, so the rule that decides whether
a render carries new input is part of the contract rather than an implementation detail. Without a
stated rule the concise form is a trap: a fresh object literal on each render either updates the
application continuously or unmounts and remounts it.

| Input                        | Compared          | Effect when it changes |
| ---------------------------- | ----------------- | ---------------------- |
| `props`                      | shallow, by value | `update()`             |
| `selection.ref`              | field by field    | remount                |
| `selection.resolve`          | shallow, by value | remount                |
| `container` object request   | shallow, by value | remount                |
| `container` resolver or type | by reference      | remount                |
| `instanceId`, `traceId`      | by value          | remount                |
| `readyTimeoutMs`             | by value          | remount                |
| `loading`, `fallback`        | not compared      | next render only       |

Rules:

1. A render that repeats the same values must not call `update()` and must not remount.
2. `props` uses shallow equality, matching the contract callers already expect from `React.memo`.
   `arePropsEqual` overrides it for props that need a different rule.
3. Nested records inside a container request or a resolution policy — `attributes`, `metadata` — are
   compared one level deeper, because they are also normally written inline.
4. Functions compare by reference at every depth. A container request resolver's behaviour is not
   observable from its shape, so a new function is treated as a new request.
5. `'dom'` and `'shadow'` shorthands resolve to frozen module-level constants, never to a fresh
   object per render.

`@fronts/react` and `@fronts/vue3` already implement rules 1 to 4 for `appProps`, `container`, and
`resolve`, so the shortcuts inherit them rather than adding a second comparison layer. The Vue
binding additionally keeps updating when a reactive prop object is mutated in place, because that
mutation preserves object identity and is therefore the change itself.

## Vue and other frameworks

`createVueBindings(host)` is the same shape with Vue rendering, and it composes with the same
`createMfHost()` result. No `@fronts/vue3-mf` package is required, because transport composition was
never part of the framework binding in the first place.

## Host services

Capability scoping is preserved rather than replaced with an ambient event bus. The producer
declares what it needs, the shell decides what to grant:

```tsx
interface HostServices {
  readonly navigation: { go(path: string): void };
  readonly telemetry: { emit(name: string, data?: unknown): void };
}
```

`services`, `createServices`, and `capabilityPolicy` pass through to `createFrontsHost()`.
Authorization and revocation continue to belong to core. The shortcuts add no compile-time check
that a remote's declared capabilities are granted, because that declaration lives inside the remote
bundle and cannot be verified from the shell before loading it; `capabilityPolicy` remains the
enforcement point.

## Lifecycle semantics

The shortcuts must not weaken the existing lifecycle contract:

1. Rendering an application starts resolution, loading, container preparation, mount, and readiness.
2. `loading` remains visible until the remote React tree commits its initial usable render.
3. Changed props call `update()` on the retained application instance.
4. Unmounting the React wrapper aborts pending work and then unmounts the application.
5. `retry()` creates a fresh operation; it never resumes a partially failed mount.
6. A render failure reaches `fallback` and `onError` with the real error.
7. `host.dispose()` rejects new operations, aborts pending work, unmounts retained instances, and
   remains safe when called more than once.
8. Replacement, activation, deactivation, inspection, and audit remain available through `host`
   rather than expanding the common component props.

## Error handling

The bindings keep the simple React surface while retaining phase information:

```tsx
const Checkout = component('checkout', {
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

The bindings must not log errors automatically. Applications decide how errors are displayed; the
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

## The Module Federation runtime lifecycle gap

`createMfHost()` creates something it cannot release. The official runtime has no destroy operation,
and `createInstance()` appends every instance to a global registry keyed by a timestamped id:

```js
function createInstance(options) {
  const instance = new ModuleFederation({
    id: `${options.name}@${options.version || Date.now()}`,
    ...options,
  });
  setGlobalFederationInstance(instance); // pushes onto __FEDERATION__.__INSTANCES__, never removed
  return instance;
}
```

So `host.dispose()` disposes the Fronts Host and deliberately leaves the runtime alone. It does not
pretend to destroy state that has no matching public destroy API, and it does not reach into the
runtime's global registry.

The practical consequences are:

- Create at most one host per composition root. Repeated calls leak one runtime instance each, and
  the timestamped id means they cannot even be deduplicated.
- Under hot module replacement, or anywhere a root is recreated, pass an existing `runtime` instead
  of letting the factory create one.
- Creating the runtime is a convenience for the single-root case, not the recommended shape for a
  platform shell. A shell that already owns a runtime should inject it.

[Host Runtime API](host-runtime-api.md) records this as the exception to its rule that a shell
disposes the transport objects it creates.

## Package boundaries

```text
@fronts/core         framework- and transport-neutral contracts
@fronts/mf           official Module Federation runtime adapter, plus createMfHost()
@fronts/react        React producer and host bindings, plus createReactBindings()
@fronts/vue3         Vue producer and host bindings, plus createVueBindings()
```

This preserves the dependency rule in [Architecture](architecture.md) exactly as written: no new
package, no horizontal dependency between sibling adapters, and no fourth layer to define. A fused
`@fronts/react-mf` preset would have required all three.

## Non-goals

The shortcuts do not:

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

1. Add `createMfHost()` to `@fronts/mf`, composing only current public exports.
2. Add `createReactBindings()` to `@fronts/react` on top of the existing `RemoteApp` behaviour.
3. Implement `component()` as a stable component factory around the inline `App` form.
4. Add `createVueBindings()` to `@fronts/vue3` once the React shape is accepted.
5. Do not deprecate `createFrontsHost()`, `createModuleFederationAdapter()`, or `RemoteApp`.

Existing code remains valid. A current host migrates incrementally by replacing only its static
composition root; producers require no change.

## Acceptance criteria

The API is successful only if all of the following hold:

- A fixed React remote can be configured and rendered with `createMfHost()`,
  `createReactBindings()`, and one JSX element.
- No mutable singleton or import-order behaviour is introduced.
- Moving an application from the static `apps` map to a registry resolver changes only the
  composition root.
- Prop changes use the existing update lifecycle and do not remount by default.
- Unmount and retry remain cancellation-safe.
- Static application names infer their exact prop types.
- A custom resolver, service provider, capability policy, observer, and official runtime instance
  remain supported.
- DOM and Shadow DOM retain concise forms; iframe configuration stays explicit.
- `host` exposes replacement, inspection, and audit without duplicating them.
- The shortcuts pass the same real Module Federation runtime integration and lifecycle contract
  tests as the low-level composition.
- `@fronts/react` gains no dependency on `@fronts/mf`, and neither gains a new published package.

## Verification

Verification: Missing. No part of this proposal is implemented, so there is no executable evidence
yet. Accepting it requires, at minimum:

- contract tests that run the shortcuts against the same real Module Federation runtime integration
  as the low-level composition;
- type-level tests for the application name to prop contract correlation;
- an example that exercises the shortcuts end to end in both browser E2E modes.

## Final recommendation

Keep `defineReactApp()` as the producer API. Add `createMfHost()` to `@fronts/mf` and
`createReactBindings()` to `@fronts/react`.

This gives the common React plus Module Federation path the brevity users expect while preserving
the explicit, testable, policy-aware runtime underneath, and it does so without fusing two
independent concerns into a package that would have to depend on both.
