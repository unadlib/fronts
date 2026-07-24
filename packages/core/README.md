# @fronts/core

Framework-neutral application protocol and host runtime for Fronts 2.0.

```sh
pnpm add @fronts/core
```

## Define an application

<!-- typecheck: services -->

```ts
import { defineApp } from '@fronts/core';

export default defineApp<{ message: string }, HostServices>({
  name: 'notice',
  capabilities: ['telemetry'],
  mount({ props, services, target }) {
    const element = document.createElement('p');
    element.textContent = props.message;
    target.append(element);
    services.telemetry.emit('notice.mounted');

    return {
      update(next) {
        element.textContent = next.message;
      },
      unmount() {
        element.remove();
      },
    };
  },
});
```

## Compose a host from module loaders

When the build already knows how to reach an application, the loader is the whole configuration.
`createModuleHost()` synthesizes the resolver and application loader, infers props contracts from
each application's own `defineApp` declaration, and returns the composition the framework bindings
accept:

<!-- typecheck: application -->

```ts
import { createModuleHost } from '@fronts/core';

const composition = createModuleHost({
  name: 'shell',
  apps: {
    notice: () => import('./application.js'),
  },
});

const app = await composition.host.mount({
  ref: composition.applications.notice,
  target: document.querySelector('#slot')!,
  props: { revision: 1 },
});
```

## Create a host

Supply an explicit `resolver` and `loader` when deployment selection is caller-owned:

<!-- typecheck: transport -->

```ts
import { createDomContainer, createFrontsHost, createStaticResolver } from '@fronts/core';

const host = createFrontsHost({
  resolver: createStaticResolver([
    { match: { name: 'notice' }, resolve: { source: mySource, version: '2.0.0' } },
  ]),
  loader: myLoader,
  containers: [createDomContainer()],
  services: { telemetry },
});

const app = await host.mount({
  ref: { name: 'notice' },
  target: document.querySelector('#slot')!,
  props: { message: 'Hello' },
});

await app.update({ message: 'Updated' });
await app.unmount();
host.assertIdle();
```

## Public surfaces

The main entry exports:

- `defineApp()` and protocol validation
- `createFrontsHost()` and mounted-instance controls
- `createModuleHost()` for composing a Host from application module loaders
- static, registry, cached, and fallback resolvers
- DOM and Shadow DOM containers
- resolution-aware container planning before loader selection
- static and instance-provided capability-scoped services
- correlated operation contexts for resolvers, loaders, and containers
- typed errors, lifecycle events, replacement, and leak audit

Additional entry points:

- `@fronts/core/iframe` — origin-bound iframe container/proxy, child agent, and negotiated RPC
  capabilities

See the [Host Runtime API guide](../../docs/host-runtime-api.md) for resolution, preload, mount,
replacement, contextual services, observability, and shutdown workflows.
See the [iframe deployment guide](../../docs/iframe-deployment.md) for cross-origin parent/child
wiring, capability negotiation, browser policy, and production teardown.

The core package has no React, Vue, bundler, or Module Federation dependency. Pair it with
`@fronts/mf`, a custom loader, or both.

Fronts is currently alpha. Protocol and API changes may occur before 2.0 stable.

MIT
