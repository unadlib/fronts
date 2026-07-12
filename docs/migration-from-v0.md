# Migration from Fronts 0.x

Fronts 2.0 is a protocol redesign, not an in-place API upgrade. Migrate application by application;
do not expose the archived implementation in a production bundle.

## Concept mapping

| Fronts 0.x                         | Fronts 2.0                                                     |
| ---------------------------------- | -------------------------------------------------------------- |
| `boot(render, root)`               | export `defineApp()`, `defineReactApp()`, or `defineVueApp()`  |
| render function returning cleanup  | `mount()` returning an `AppHandle`                             |
| `useApp({ name, loader })`         | host `mount()` or React/Vue `RemoteApp`                        |
| `useWebComponents()`               | `{ type: 'shadow' }` container                                 |
| `useIframe()`                      | iframe container + child agent                                 |
| `site.json` dependency URLs        | `AppResolver` + concrete `ResolvedApp` source                  |
| `fronts-bundler` Webpack wrapper   | official MF 2 bundler plugin                                   |
| `window.__FRONTS__*`               | explicit protocol and host instance                            |
| global transport/event bus         | typed capability-scoped host services                          |
| implicit CSS capture/injection     | producer-owned CSS strategy                                    |
| ad-hoc registry `?scope=app@range` | resolver contract with range/channel/environment/tenant/cohort |
| React `useApp()` remount behavior  | explicit mount and `update()` lifecycle                        |

## Phase 0: inventory

For each application record:

- current `site.json`, remote/script URL, exposed bootstrap, and framework version;
- whether render returns reliable cleanup;
- global events/services used;
- CSS assumptions and portals;
- required browser APIs/origin privileges;
- release/channel/tenant behavior;
- whether MF 2 official Bridge alone is sufficient.

Do not migrate a simple remote component to Fronts merely for uniform branding. Keep component
composition on MF Runtime/Bridge unless application governance is required.

## Phase 1: introduce a 2.0 host

Create the host, resolver, service catalog, capability policy, and containers. Start with static
resolution that points to existing production artifacts. Add lifecycle telemetry and require
`host.assertIdle()` in integration tests before migrating producers.

## Phase 2: run legacy script applications

Use `createLegacyScriptLoader()` only for old bundles that register through
`window.__FRONTS__DYNAMIC__MODULES__`:

```ts
import { createLegacyScriptLoader } from '@fronts/core/legacy';

const legacyLoader = createLegacyScriptLoader({
  allowedOrigins: ['https://legacy-cdn.example.com'],
  requireIntegrityForCrossOrigin: true,
  timeoutMs: 10_000,
});
```

Resolve a legacy source:

```ts
{
  version: '0.8.4',
  source: {
    url: 'https://legacy-cdn.example.com/orders/0.8.4/bundle.js',
    globalName: 'orders',
    integrity: 'sha384-…'
  }
}
```

The adapter converts `render(target, props) => cleanup` to the new ABI. Set `updateMode: 'reject'`
unless remount-on-update is an explicitly accepted compatibility behavior.

## Phase 3: replace the producer entry

For React:

```tsx
export default defineReactApp<Props, Services>({
  name: 'orders',
  capabilities: ['navigation', 'telemetry'],
  root: Orders,
});
```

For Vue 3:

```ts
export default defineVueApp<Props, Services>({
  name: 'orders',
  capabilities: ['telemetry'],
  root: Orders,
});
```

Expose it with the official Module Federation plugin as `./application`. Keep the standalone SPA
entry separate; it can import and mount the same root for local development.

## Phase 4: move discovery to a resolver

Replace distributed `site.json` URLs with logical references. Start with static mappings, then
introduce the registry endpoint. Preserve immutable artifacts and return selected version plus a
deployment/policy identifier for tracing.

Do not reproduce the old dependency graph in Fronts. Nested producers may use MF for module
dependencies, while the platform host decides which independently governed applications exist.

## Phase 5: replace global communication

For each global event or object:

1. identify the intent and owner;
2. define the smallest typed service method;
3. make the application declare the capability;
4. authorize it in host policy;
5. validate arguments and emit audit telemetry;
6. remove the global after all consumers migrate.

Avoid a `globalTransport` compatibility service that simply recreates ambient authority.

## Phase 6: choose isolation deliberately

- DOM for trusted, design-system-aligned applications.
- Shadow DOM when producer CSS is compatible and style containment is needed.
- cross-origin iframe for lower-trust or framework/runtime conflicts.

Do not promise that moving an existing style-loader bundle into Shadow DOM will automatically move
its CSS. Change the producer stylesheet strategy first.

## Phase 7: remove compatibility code

An application is complete when:

- no `window.__FRONTS__*` dependency remains;
- it exports the 2.0 protocol and passes contract tests;
- update/readiness/unmount semantics are verified;
- services are declared and authorized;
- its release is resolver-driven and rollback-tested;
- the host audit is idle after teardown.

After the final application migrates, remove the legacy loader, old globals, old bundles, and any
temporary CSP/SRI exceptions. The repository's ignored `old/` directory is research material only
and must never be published or committed.

## Important behavior changes

- Application identity is per mount, not just a global name.
- Props update in place when supported; it is not an implicit remount.
- CSS isolation is an explicit container/producer decision.
- iframe code loads inside the iframe's MF instance.
- services are denied unless both declared and authorized.
- resolution is cancellable and policy context is explicit.
- readiness is a first-class promise and gates replacement.
- teardown failures are observable and leak audits can fail tests.
