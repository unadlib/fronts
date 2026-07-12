# Application contract

## Protocol identity

Every producer exports a `FrontsApp` created by `defineApp()`, `defineReactApp()`, or
`defineVueApp()`. The helper adds a non-enumerable symbol brand plus enumerable protocol name and
version fields. The symbol is a local marker; the cross-package ABI is the structural mount shape
plus the protocol name and major version. The host validates that ABI, and a symbol brand never
bypasses protocol-version validation.

The exposed Module Federation module should normally have this shape:

```ts
export interface FrontsAppModule<Props, Services extends object> {
  readonly default: FrontsApp<Props, Services>;
}
```

The default expose is `./application`; callers can choose another expose in `AppRef`.

## Mount input

```ts
interface MountContext<Props, Services extends object> {
  readonly identity: {
    readonly instanceId: string;
    readonly name: string;
    readonly version?: string;
    readonly expose?: string;
    readonly traceId?: string;
  };
  readonly props: Readonly<Props>;
  readonly services: Readonly<Services>;
  readonly signal: AbortSignal;
  readonly target: Element | ShadowRoot;
}
```

Invariants:

- `identity.instanceId` is unique while its mount transaction or retained instance record exists.
- the `props` reference is captured when the mount transaction starts, but Fronts does not clone or
  freeze the caller's object. Callers and producers must treat it as read-only shared input.
- `services` contains only declared and authorized capabilities.
- `signal` aborts when mounting is cancelled or the instance is force-aborted.
- `target` is supplied and controlled by the selected container for the lifetime of this mount.
- a producer must render only inside its target unless a declared platform capability explicitly
  permits another effect.

## Mount output

```ts
interface AppHandle<Props> {
  readonly ready?: PromiseLike<void>;
  update?(props: Readonly<Props>): void | PromiseLike<void>;
  activate?(): void | PromiseLike<void>;
  deactivate?(): void | PromiseLike<void>;
  unmount(): void | PromiseLike<void>;
}
```

### `ready`

`mount()` means resources were accepted; `ready` means the application committed its usable UI.
If omitted, the application is ready as soon as `mount()` returns. Hosts impose a deadline.

Readiness must reject on initial render failure. It must not wait for optional analytics,
background data, or an interaction that may never happen. Replacement commits only after
readiness succeeds.

### `update(props)`

Updates an existing mounted application without changing identity, deployment, target, or service
scope. Implementations should resolve after the framework commits the update. When unsupported,
the host reports a typed lifecycle failure instead of silently remounting.

### `activate()` and `deactivate()`

Optional visibility/activity hints. They are not mount/unmount and must preserve application
state. Typical uses are pausing timers, subscriptions, media, or expensive rendering while a tab
is inactive.

### `unmount()`

Required and treated as idempotent by the host boundary. It must remove render roots, listeners,
timers, observers, subscriptions, and producer-owned DOM. It must not remove the container element;
the container adapter owns that resource.

## State machine

```text
resolving → loading → preparing → mounting → ready
                                             │
                 ┌──────── updating ◄────────┤
                 ├──────── active   ◄────────┤
                 └──────── inactive ◄────────┘
                                             │
                                             ▼
                                      unmounting → destroyed

Any pending phase ── failure/abort + rollback ──► failed | aborted (terminal)
```

Operations are serialized per instance. Calls that are invalid for the current state reject with
a `FrontsError`; they are never silently queued across destruction. Clean failed/aborted
transactions release their host record after rollback; incomplete cleanup remains visible to
`host.audit()` without inventing a later `destroyed` transition.

## Cancellation

An external mount signal is combined with an instance-owned signal. Aborting either prevents later
phases from starting and triggers rollback. Loaders and resolvers receive the signal and should
pass it to network requests. Application code must listen when it starts long-running work.

Aborting is cooperative: JavaScript already evaluated in the same realm cannot be forcibly
stopped. Stronger runtime isolation requires an iframe and ultimately destroying that child realm.

## Capabilities

Applications declare string keys:

```ts
export default defineApp<Props, HostServices>({
  capabilities: ['navigation', 'telemetry'],
  // ...
});
```

Declaration is necessary but not sufficient. The host's `capabilityPolicy` evaluates each key for
the concrete application identity and receives the instance `signal`. The runtime stops awaiting
asynchronous authorization when that signal aborts. A declared capability that is unavailable or
denied rejects an ordinary application mount; undeclared services never enter its facade. A service
scope is revoked on cleanup, so retained method proxies fail rather than continuing to affect the
host.

Static `services` remain the simplest host configuration. When a capability must be bound to one
application instance, use `createServices` as an instance-level provider:

```ts
const host = createFrontsHost({
  // resolver, loader, static services ...
  createServices({ identity, operation, resolved, resolution, capabilities, signal }) {
    const channel = telemetry.open({
      app: identity.name,
      instanceId: identity.instanceId,
      tenant: resolution.tenant,
      traceId: operation.traceId,
      version: resolved.version,
      signal,
    });

    return {
      services: { telemetry: channel },
      dispose: () => channel.close(),
    };
  },
});
```

The provider runs once per mount/replace transaction after resolution and application validation.
Its frozen `capabilities` list contains declarations, not grants. Provider services override static
services with the same key; the host then applies availability checks and `capabilityPolicy`, and
only the requested, authorized keys enter the application facade.

Returning the result transfers ownership to the host. `dispose` is called at most once after
facade revocation, including authorization failure, aborted mount, ordinary unmount, and host
shutdown. It may be asynchronous; a failure is surfaced as an unmount cleanup failure without
skipping container disposal. An aborted mount stops awaiting a pending provider; if its result
arrives later, the host disposes it and keeps that cleanup visible as a pending operation. Providers
must still honor `signal` to stop work promptly. If a provider throws before returning its result,
it still owns rollback of any partially allocated resources.

For iframe applications, `IframeProxyLoaderOptions.capabilities` is a host-controlled maximum,
not a list of mandatory dependencies and not the final child grant. Entries unavailable from the
instance service provider or denied by policy are omitted from the parent offer rather than failing
the proxy before the child is known. After loading the real child application, the agent negotiates
its declared subset with the parent. Only the exact negotiated intersection becomes RPC stubs, and
the parent checks that grant on every call. A child is still rejected when one of its own declared
requirements is absent from that offer.

Prefer narrow intent APIs such as `navigation.go()` and `telemetry.emit()` over ambient objects
such as `window`, a Redux store, or a generic message bus.

## Framework adapters

### React

`defineReactApp()` owns a React root, context, error boundary, commit-based readiness, prop updates,
optional Strict Mode, and root unmount. Host services and identity are available through hooks.

### Vue 3

`defineVueApp()` owns a Vue app, provided context, reactive prop updates, `nextTick()` readiness,
configuration hook, and app unmount. It creates an inner element when mounting into Shadow DOM.

These adapters intentionally expose fewer framework-specific features than the official MF
Bridge. Use official Bridge directly when its routing/data/SSR integration is the actual
requirement; use Fronts adapters when the application must participate in the Fronts host ABI.

## Compatibility rule

Protocol major versions are strict. A host must reject an unknown major rather than trying to
guess behavior. New optional handle methods can be added compatibly; changing mount semantics,
readiness, service authorization, or cleanup ownership requires a new protocol major.
