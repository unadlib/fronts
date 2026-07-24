# Fronts 2.0

Fronts is a framework-neutral **application runtime** for independently delivered web
applications. Its core accepts any application loader. When a platform chooses Module Federation
2 for discovery and loading, `@fronts/mf` connects the official runtime to the application-level
contract and production controls that a module loader intentionally does not own.

> Status: Fronts 2.0 is in prerelease development and has not yet been published to npm. The
> repository is prepared to publish prereleases under the `next` tag. The architecture and protocol
> are implemented and tested, but the public API may still change before the first stable release.

## Why Fronts still exists after Module Federation 2

Module Federation 2 now has an excellent runtime, manifests, preloading, runtime plugins, type
hints, observability, and React/Vue bridges. Fronts does not duplicate those capabilities.

| Concern                                                                      | Owner                               |
| ---------------------------------------------------------------------------- | ----------------------------------- |
| Remote manifests, entries, exposes, shared dependencies, runtime plugins     | Module Federation                   |
| React/Vue application and router integration within an MF-only architecture  | Official MF Bridge, when sufficient |
| Framework-neutral application ABI and lifecycle state machine                | Fronts                              |
| Environment/tenant/cohort/channel resolution policy                          | Fronts resolver layer               |
| DOM, Shadow DOM, and isolated iframe execution behind one host API           | Fronts containers                   |
| Capability-scoped host services                                              | Fronts service scopes               |
| Readiness-gated replacement, rollback, cancellation, tracing, and leak audit | Fronts host                         |

If an application only needs `loadRemote()` or an official React/Vue Bridge component, use Module
Federation directly. Fronts is useful when a platform needs one governed application model across
frameworks, loaders, isolation levels, and release policies.

## Packages

- `@fronts/core` — application protocol, host, resolvers, containers, services, and iframe agent
- `@fronts/mf` — adapter over the public `@module-federation/runtime` instance API
- `@fronts/react` — React producer and host adapters
- `@fronts/vue3` — Vue 3 producer and host adapters

## Quick start

Define a React application in the remote:

<!-- typecheck -->

```tsx
import { defineReactApp } from '@fronts/react';

export default defineReactApp<{ name: string }>({
  name: 'hello',
  root: ({ name }) => <h1>Hello, {name}!</h1>,
});
```

Expose that module as `./application` with the producer's official Module Federation plugin, then
turn it into an ordinary typed React component in the shell:

<!-- typecheck -->

```tsx
import { createMfHost } from '@fronts/mf';
import { createReactBindings } from '@fronts/react';

interface Apps {
  readonly hello: { readonly name: string };
}

const composition = createMfHost<Apps>({
  name: 'shell',
  apps: {
    hello: {
      remote: 'hello_remote',
      entry: 'http://localhost:3001/mf-manifest.json',
    },
  },
});

const Hello = createReactBindings(composition).component('hello');

export function App() {
  return <Hello name="Fronts" />;
}
```

The default expose is `./application` and the default container is the DOM. Keep `composition` at
the shell lifecycle boundary and call `composition.host.dispose()` when the shell shuts down.
`defineVueApp()` and `createVueBindings()` provide the same application contract and composition
flow for Vue 3.

The official Module Federation runtime remains the only owner of remote registration, manifests,
preloading, exposed-module loading, and shared dependency resolution. `@fronts/mf` only maps a
resolved application source to `registerRemotes()`, `preloadRemote()`, and `loadRemote()`.
`createFrontsHost()`, `createModuleFederationSource()`, and `createModuleFederationAdapter()` remain
available when a platform needs to assemble those boundaries directly.

When the build already knows how to reach an application, no transport package is involved at all.
`createModuleHost()` in `@fronts/core` takes the `import()` directly and infers each props contract
from the application's own definition:

<!-- typecheck: application -->

```ts
import { createModuleHost } from '@fronts/core';

const composition = createModuleHost({
  name: 'shell',
  apps: {
    notice: () => import('./application.js'),
  },
});
```

The same Host, containers, capability-scoped services, replacement, and leak audit apply. See
[Typed composition shortcuts](docs/composition-shortcuts.md) for when to choose which composition
root.

## Examples

The core-only example on `http://127.0.0.1:4110` demonstrates a custom loader, vanilla DOM
application, capability-scoped service, updates, unmounting, and leak audit using only
`@fronts/core`.

The Module Federation vertical slice on `http://127.0.0.1:4100` contains a React host plus three
independently served applications:

- React over Module Federation in a DOM container
- Vue 3 over Module Federation in a Shadow DOM container
- React over Module Federation inside an iframe with its own MF runtime instance

The Vite runtime examples pair:

- a plain Vite host on `http://127.0.0.1:4200` that uses `@module-federation/runtime` directly and
  does not install the MF Vite plugin
- a Vite remote on `http://127.0.0.1:4201` that uses `@module-federation/vite` to expose the same
  Fronts application ABI
- a Vite remote on `http://127.0.0.1:4202` that uses `vite-plugin-federation` and is consumed through
  its MF2 manifest by the same host at `/?producer=vite-plugin-federation`
- a production-only Vite 5.4 compatibility remote on `http://127.0.0.1:4203` that uses
  `@originjs/vite-plugin-federation`; the same host consumes its ESM `remoteEntry.js` at
  `/?producer=originjs` and validates the remote's shared `@fronts/core` fallback

Run every example service with:

```sh
pnpm install
pnpm build
pnpm dev:examples
```

Then open any host URL above.

## Documentation

- [Documentation index](docs/index.md) — guided reading paths and maintenance rules
- [Decision record](docs/decision-record.md) — whether Fronts 2.0 is justified after MF 2
- [Architecture](docs/architecture.md) — layers, ownership, and dependency rules
- [Application contract](docs/application-contract.md) — lifecycle ABI and invariants
- [Host Runtime API](docs/host-runtime-api.md) — resolution, lifecycle, replacement, and shutdown workflows
- [Typed composition shortcuts](docs/composition-shortcuts.md) — concise MF plus React or Vue composition
- [Module Federation integrations](docs/module-federation-integrations.md) — producer compatibility and support boundaries
- [Resolution and delivery](docs/resolution-and-delivery.md) — versions, channels, caching, and rollback
- [Iframe deployment](docs/iframe-deployment.md) — cross-origin wiring, capabilities, and production security
- [Isolation and security](docs/isolation-and-security.md) — DOM, Shadow DOM, iframe, and capabilities
- [Operations](docs/operations.md) — tracing, failure handling, and leak auditing
- [Support policy](docs/support-policy.md) — versions, environments, browsers, and prerelease guarantees
- [Troubleshooting](docs/troubleshooting.md) — phase-oriented diagnosis and recovery
- [Security policy](SECURITY.md) — private vulnerability reporting and disclosure boundaries
- [Contributing](CONTRIBUTING.md) — development, tests, Changesets, and review expectations
- [Releasing](docs/releasing.md) — package verification, prereleases, and npm provenance

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, focused tests, Changesets, documentation, and
review expectations.

```sh
pnpm lint
pnpm docs:check
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm test:e2e          # development servers
pnpm test:e2e:preview  # fresh production builds served by preview servers
```

Node.js 22.18 or newer and pnpm 10 or 11 are required. The workspace currently pins pnpm 10 through
the `packageManager` field.

## License

MIT
