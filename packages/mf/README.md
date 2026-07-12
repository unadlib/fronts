# @fronts/mf

Module Federation 2 runtime adapter for Fronts applications.

```sh
pnpm add @fronts/core @fronts/mf @module-federation/runtime
```

`@module-federation/runtime` is a peer dependency. Supply an explicit official runtime instance;
the adapter does not create or discover a global default instance.

```ts
import { createInstance } from '@module-federation/runtime';
import { createFrontsHost, createStaticResolver } from '@fronts/core';
import { createModuleFederationAdapter, createModuleFederationSource } from '@fronts/mf';

const federation = createInstance({ name: 'shell', remotes: [] });
const source = createModuleFederationSource({
  name: 'checkout_2_4_1',
  entry: 'https://cdn.example.com/checkout/2.4.1/mf-manifest.json',
});

const host = createFrontsHost({
  resolver: createStaticResolver([
    { match: { name: 'checkout' }, resolve: { source, version: '2.4.1' } },
  ]),
  loader: createModuleFederationAdapter({ instance: federation }),
});
```

For each resolved application, the adapter uses only public instance methods:

- `registerRemotes()`
- `preloadRemote()`
- `loadRemote()`

It does not parse manifests, select shared dependencies, modify snapshots, or import
`@module-federation/runtime-core`. Those remain official Module Federation responsibilities.

The official runtime keeps the first registration when a remote name is registered again without
`force`. The adapter therefore rejects a different source or resolved version previously registered
through Fronts on the same runtime instance. Prefer an immutable, deployment-specific remote name;
use `force` only when intentionally replacing the runtime's cached deployment.

The remote module must default-export a valid Fronts application, normally from an expose named
`./application`.

Fronts is currently alpha. Protocol and API changes may occur before 2.0 stable.

MIT
