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

## Application contract

An application exports a protocol-branded object. The host owns loading and orchestration; the
application owns the UI tree it mounts.

```ts
import { defineApp } from '@fronts/core';

export default defineApp<{ accountId: string }, HostServices>({
  name: 'account',
  capabilities: ['telemetry'],
  mount({ identity, props, services, signal, target }) {
    const view = document.createElement('p');
    view.textContent = `Account ${props.accountId}`;
    target.append(view);
    services.telemetry.emit('account.mounted', identity);

    return {
      ready: Promise.resolve(),
      update(nextProps) {
        view.textContent = `Account ${nextProps.accountId}`;
      },
      unmount() {
        view.remove();
      },
    };
  },
});
```

React and Vue producers normally use `defineReactApp()` or `defineVueApp()` instead. Both produce
the same framework-neutral application contract.

## Minimal Module Federation host

```ts
import { createInstance } from '@module-federation/runtime';
import { createFrontsHost, createStaticResolver, createShadowContainer } from '@fronts/core';
import { createModuleFederationAdapter, createModuleFederationSource } from '@fronts/mf';

const federation = createInstance({ name: 'store-shell', remotes: [] });
const source = createModuleFederationSource({
  name: 'checkout_2_4_1',
  entry: 'https://cdn.example.com/checkout/2.4.1/mf-manifest.json',
});

const host = createFrontsHost({
  resolver: createStaticResolver([
    { match: { name: 'checkout', channel: 'stable' }, resolve: { source, version: '2.4.1' } },
  ]),
  loader: createModuleFederationAdapter({ instance: federation }),
  containers: [createShadowContainer()],
  services: { telemetry },
});

const checkout = await host.mount({
  ref: { name: 'checkout', expose: './application', channel: 'stable' },
  target: document.querySelector('#slot')!,
  container: { type: 'shadow' },
  props: { cartId: 'C-42' },
});

await checkout.ready;
```

The official Module Federation runtime remains the only owner of remote registration, manifests,
preloading, exposed-module loading, and shared dependency resolution. `@fronts/mf` only maps a
resolved application source to `registerRemotes()`, `preloadRemote()`, and `loadRemote()`.

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

- [Decision record](docs/decision-record.md) — whether Fronts 2.0 is justified after MF 2
- [Architecture](docs/architecture.md) — layers, ownership, and dependency rules
- [Application contract](docs/application-contract.md) — lifecycle ABI and invariants
- [Module Federation integrations](docs/module-federation-integrations.md) — producer compatibility and support boundaries
- [Resolution and delivery](docs/resolution-and-delivery.md) — versions, channels, caching, and rollback
- [Isolation and security](docs/isolation-and-security.md) — DOM, Shadow DOM, iframe, and capabilities
- [Operations](docs/operations.md) — tracing, failure handling, and leak auditing
- [Releasing](docs/releasing.md) — package verification, prereleases, and npm provenance

## Development

```sh
pnpm lint
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
