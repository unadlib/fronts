# Architecture

## System boundary

Fronts turns an application reference into a governed application instance. It is deliberately
split into layers so that release policy, transport, rendering framework, and execution isolation
can evolve independently.

```text
AppRef + ResolveContext
          │
          ▼
      AppResolver ───────────────► ResolvedApp<Source>
                                        │
                                        ▼
                              AppLoader selected by container
                              ├─ @fronts/mf → official MF instance
                              └─ iframe proxy → iframe agent + own MF instance
                                        │
                                        ▼
                                FrontsApp protocol
                                        │
                         ┌──────────────┼──────────────┐
                         ▼              ▼              ▼
                       DOM          Shadow DOM       iframe
                         │              │              │
                         └──── scoped services + lifecycle ────┘
                                        │
                                        ▼
                         events, replacement, audit, cleanup
```

## Dependency rule

Dependencies point inward:

1. `@fronts/core` has no framework, bundler, or Module Federation dependency.
2. `@fronts/mf` depends on core and peers on the public `@module-federation/runtime` package.
3. `@fronts/react` and `@fronts/vue3` depend on core and peer on their rendering framework.
4. Examples compose packages; packages never import examples or platform policy.

No Fronts source may import `@module-federation/runtime-core`. The public Runtime package is the
compatibility boundary. The official `@module-federation/enhanced/runtime` entry re-exports the
same runtime through `runtime-tools`; a pure runtime consumer can depend directly on
`@module-federation/runtime`, which avoids pulling in build-plugin concerns. See the audited
[runtime source](https://github.com/module-federation/core/blob/37c97f6ec96bcca573282cfba781ca42aefcd08d/packages/runtime/src/index.ts)
and [runtime-tools re-export](https://github.com/module-federation/core/blob/37c97f6ec96bcca573282cfba781ca42aefcd08d/packages/runtime-tools/src/runtime.ts).

## Core abstractions

### `AppRef`

A logical request: name, expose, optional semantic range, and optional release channel. It does not
contain a CDN URL.

### `ResolveContext`

Request policy inputs: environment, tenant, cohort, and metadata, plus an immutable host operation
envelope. The host does not interpret policy fields; a resolver or registry owns selection policy.
The operation envelope carries correlation and cancellation across extension boundaries.

### `ResolvedApp<Source>`

An immutable decision containing the normalized reference, transport-specific source, selected
version, and optional metadata. This object is the handoff between policy and loading.

### `AppLoader<Source>`

A transport adapter with `load()` and optional `preload()`. A loader returns an unknown module;
the host validates the Fronts application protocol before mounting it. Its context identifies the
host action and includes an application identity only for mount/replace transactions.

### `ContainerAdapter`

Prepares an execution target and owns its cleanup. A container can also select a different loader;
iframe execution uses this to ensure code is loaded inside the child realm instead of the parent.
Preparation receives the same application operation envelope used for resolution and loading.

### `FrontsApp`

The framework-neutral producer contract. React and Vue are adapters that create this contract,
not special host modes.

### `FrontsHost`

The stateful orchestrator. It resolves, loads, validates, creates a service scope, prepares a
container, mounts, waits for readiness, exposes lifecycle controls, replaces instances, emits
events, and audits retained resources.

## Ownership compared with Module Federation 2

| Capability                             | MF 2                                 | Fronts                                        |
| -------------------------------------- | ------------------------------------ | --------------------------------------------- |
| Manifest/Snapshot and asset graph      | Owns                                 | Consumes as opaque runtime behavior           |
| Remote registration and expose loading | Owns                                 | Calls public instance methods through adapter |
| Shared dependency selection            | Owns                                 | Does not intercept                            |
| Runtime loading hooks and plugins      | Owns                                 | May correlate at its boundary                 |
| Remote type generation/download        | Owns                                 | Does not replace                              |
| Framework bridge render/destroy        | Official Bridge owns for Bridge apps | Own ABI adapters only                         |
| Logical app-to-deployment policy       | Does not prescribe                   | Owns resolver contract                        |
| Cross-transport lifecycle state        | Does not prescribe                   | Owns                                          |
| DOM/Shadow/iframe container policy     | Does not prescribe                   | Owns                                          |
| Host service authorization             | Does not prescribe                   | Owns                                          |
| Ready-gated application replacement    | Does not prescribe                   | Owns                                          |
| Application instance leak audit        | Does not prescribe                   | Owns                                          |

MF runtime plugins remain the right extension point for URL rewriting, manifest fetch behavior,
script/link creation, shared resolution, and remote-load fallback. Fronts resolvers remain the
right extension point for business deployment policy. Mixing those concerns makes both layers
harder to reason about. See the official [runtime plugin guide](https://module-federation.io/guide/runtime/runtime-plugins).

## Host mount transaction

The host executes these phases in order:

1. Normalize the reference and create operation, identity, and trace IDs.
2. Resolve the deployment.
3. Choose the default or container-specific loader and load the module.
4. Validate protocol name/version and application shape.
5. Create instance-bound services when configured, authorize declared capabilities, and create a
   revocable service scope.
6. Prepare the container.
7. Call `mount()` with immutable props, scoped services, target, identity, and abort signal.
8. Wait for the application `ready` promise with a deadline.
9. Publish the instance as usable.

Failure unwinds acquired resources in reverse order. The original error remains primary; cleanup
errors are reported through typed Fronts errors and events.

## Replacement transaction

`replace(currentInstanceId, nextOptions)` is intentionally not an in-place remote mutation:

1. A hidden staging slot is created beside the current owned container.
2. The next deployment resolves, loads, mounts, and reaches `ready` in staging.
3. If any phase fails, staging is destroyed and the current instance stays active.
4. If ready succeeds, the new slot is committed, then the previous instance is unmounted.
5. A previous cleanup failure is returned separately; it does not pretend the new application
   failed to become ready.

Concurrent replacement of one instance is rejected. This gives the platform a clear transaction
boundary without mutating MF runtime caches behind an active application.

## Extension points

- Implement `AppResolver` for a deployment registry or experiment service.
- Implement `ResolutionCache` for shared or persistent policy caching.
- Implement `AppLoader` for a non-MF transport.
- Implement `ContainerAdapter` for another execution target.
- Subscribe to `HostEvent` and map it to OpenTelemetry or an internal telemetry pipeline.
- Use `createServices` for instance-bound capability implementations and deterministic cleanup.
- Use `capabilityPolicy` for tenant, identity, or deployment-specific authorization.

Extension points are explicit objects, not process-wide globals.
