# @fronts/core

Framework-neutral application protocol and host runtime for Fronts 2.0.

```sh
pnpm add @fronts/core
```

## Define an application

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

## Create a host

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
- static, registry, cached, and fallback resolvers
- DOM and Shadow DOM containers
- static and instance-provided capability-scoped services
- correlated operation contexts for resolvers, loaders, and containers
- typed errors, lifecycle events, replacement, and leak audit

Additional entry points:

- `@fronts/core/iframe` — parent iframe container/proxy and child agent

The core package has no React, Vue, bundler, or Module Federation dependency. Pair it with
`@fronts/mf`, a custom loader, or both.

Fronts is currently alpha. Protocol and API changes may occur before 2.0 stable.

MIT
