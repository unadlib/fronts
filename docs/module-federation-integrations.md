---
type: contract
title: Module Federation Integrations
description: Supported ownership boundary, producer compatibility tiers, and verification paths for Module Federation delivery.
owner: unadlib/fronts maintainers
status: proposed
tags: [module-federation, compatibility, delivery]
---

# Module Federation integrations

## Purpose

This document defines what Fronts supports when Module Federation is selected as an application
delivery transport. It distinguishes a supported Fronts runtime contract from a producer artifact
that happens to be interoperable in one tested configuration.

Fronts core does not require Module Federation. `@fronts/mf` is an adapter over an explicitly
supplied official Module Federation runtime instance; it does not implement another manifest
parser, share resolver, remote registry, or bundler plugin.

## Ownership boundary

```mermaid
flowchart LR
  Policy[Fronts resolver policy] --> Resolved[Resolved application]
  Resolved --> Adapter[@fronts/mf]
  Adapter --> Runtime[Official MF runtime instance]
  Runtime --> Artifact[Manifest or remote entry]
  Artifact --> Export[FrontsApp export]
  Export --> Lifecycle[Fronts lifecycle and container]
```

This shows the stable ownership boundary: Fronts selects a deployment and governs its application
lifecycle, while the official runtime owns remote registration, manifest interpretation, exposed
module loading, and shared dependencies.

Rules:

- A Fronts Host using MF MUST pass an explicit official runtime instance to `@fronts/mf`.
- A producer MUST expose a valid `FrontsApp`, normally as `./application`; exposing a React or Vue
  component alone does not satisfy the Fronts application contract.
- Fronts MUST NOT depend on a producer plugin's private or virtual Host API.
- Shared dependency selection remains an MF concern. Fronts MUST NOT infer or rewrite a producer's
  share graph.
- A deployment SHOULD use an immutable MF remote name. Rebinding one name to another source without
  explicit force is rejected because the official runtime caches registrations and loaded modules.

The public adapter boundary is defined by
[`ModuleFederationInstance`](../packages/mf/src/types.ts) and implemented through public instance
methods in [`adapter.ts`](../packages/mf/src/adapter.ts).

## Compatibility vocabulary

| Tier                            | Meaning                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Core-native                     | No MF dependency. A custom `AppLoader` supplies the same Fronts application protocol.                                   |
| Official integration            | Official Module Federation runtime plus an official producer plugin, covered by repository integration and E2E tests.   |
| Verified producer compatibility | A third-party producer artifact is consumed by the official runtime and passes the documented Fronts E2E lifecycle.     |
| Narrow compatibility fixture    | Only the checked-in version, output format, and execution mode are claimed. It is not a general plugin support promise. |

“Verified” means that the repository proves the stated path. It does not transfer ownership of the
producer plugin to Fronts or promise compatibility with every version and output format.

## Integration matrix

| Delivery path                       | Host-side loader                               | Producer artifact            | Development path     | Production preview | Tier                            | Evidence                                                                                                                 |
| ----------------------------------- | ---------------------------------------------- | ---------------------------- | -------------------- | ------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Custom loader, no MF                | User-provided `AppLoader`                      | Any valid `FrontsApp` source | Yes                  | Yes                | Core-native                     | [`core-only`](../examples/core-only/README.md)                                                                           |
| `@module-federation/rsbuild-plugin` | `@fronts/mf` + official MF runtime             | MF manifest                  | Yes                  | Yes                | Official integration            | [`react-remote`](../examples/react-remote/rsbuild.config.ts), [`vue3-remote`](../examples/vue3-remote/rsbuild.config.ts) |
| `@module-federation/vite`           | Plugin-free Vite shell + official MF runtime   | MF manifest                  | Yes                  | Yes                | Official integration            | [`vite-remote`](../examples/vite-remote/vite.config.ts)                                                                  |
| `vite-plugin-federation`            | Same plugin-free shell and official MF runtime | MF manifest                  | Yes                  | Yes                | Verified producer compatibility | [`vite-plugin-federation-remote`](../examples/vite-plugin-federation-remote/vite.config.ts)                              |
| `@originjs/vite-plugin-federation`  | Same plugin-free shell and official MF runtime | ESM `remoteEntry.js`         | Build + preview only | Yes                | Narrow compatibility fixture    | [`originjs-vite-remote`](../examples/originjs-vite-remote/vite.config.ts)                                                |

All Vite rows deliberately use the same [plain Vite Host](../examples/vite-host/README.md). The Host
does not install any federation build plugin: it creates an official runtime instance and passes it
to `@fronts/mf`.

### Official Rsbuild and Vite producers

These are the preferred MF producer paths. Both emit a manifest consumed by the official runtime.
A manifest is preferred over a raw entry because it preserves metadata used by official preloading,
snapshot, type-hinting, and DevTools features. Fronts consumes none of those internals directly.

The repository proves:

- React and Vue applications exposed through the official Rsbuild plugin;
- a framework-neutral application exposed through the official Vite plugin;
- mount, framework readiness, updates, host services, and unmount;
- DOM, Shadow DOM, and cross-origin iframe execution across the full example suite.

### `vite-plugin-federation`

The unscoped plugin is supported as a compatible producer, not as the Fronts Host runtime. Its
fixture emits `mf-manifest.json`, and the Host consumes that manifest through its own official
runtime instance. The plugin's bundled runtime MUST NOT be passed to `@fronts/mf`.

Both the Vite development server and a fresh production preview are exercised by the same lifecycle
E2E. This claim is limited to the manifest producer path checked into this repository.

### OriginJS

OriginJS is a deliberately narrow compatibility fixture:

- the remote is built as ESM and consumed from `assets/remoteEntry.js`;
- its `dev` script builds and previews output because a bundleless remote dev mode is unavailable;
- the fixture stays on Vite 5.4 because its current output transform is not compatible with this
  repository's Vite 8/Rolldown producer pipeline;
- its generated `@fronts/core` fallback is retained and verified through share-scope initialization;
- the OriginJS `virtual:__federation__` Host API is not used or supported by Fronts.

This does not claim compatibility with SystemJS/`var` output, OriginJS as the Host loader, or newer
Vite pipelines. Expanding the claim requires a dedicated fixture and both lifecycle and shared
dependency verification.

## Dependency choices

| Use case                               | Consumer dependencies                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Fronts without Module Federation       | `@fronts/core`                                                                                           |
| Fronts Host loading MF remotes         | `@fronts/core`, `@fronts/mf`, `@module-federation/runtime`                                               |
| React or Vue producer                  | Corresponding Fronts framework adapter plus the producer's official MF build plugin                      |
| Framework-neutral official Vite remote | `@fronts/core`, `@module-federation/vite`                                                                |
| Third-party Vite producer              | `@fronts/core` or a framework adapter plus that producer plugin; no additional Fronts runtime API exists |

Package manifests remain the source of truth for exact peer ranges. See
[`@fronts/mf`](../packages/mf/package.json), [`@fronts/react`](../packages/react/package.json), and
[`@fronts/vue3`](../packages/vue3/package.json).

## Adding another producer

A compatibility claim is complete only when all of the following are true:

1. The producer exposes `./application` as a valid Fronts application.
2. The plain Host loads it through an explicit official runtime instance.
3. The test proves mount/readiness, host service access, update, unmount, and idle audit.
4. Shared behavior is tested when the producer emits a share graph or fallback.
5. Development and production modes are documented separately; unsupported modes fail no claim.
6. CORS and public asset URLs work from a distinct Host origin.
7. The matrix records the exact evidence boundary instead of generalizing from one successful load.

No new Fronts Runtime API is required merely to support another conforming producer artifact.

## Verification

- `pnpm exec vitest run packages/mf/test` verifies source validation, official instance calls, immutable
  remote binding, preload mapping, cancellation, and real remote-container loading.
- `pnpm test:e2e` verifies the complete matrix against development server commands.
- `pnpm test:e2e:preview` rebuilds every producer and verifies the matrix against production output;
  this is the browser path run by CI.
- [`e2e/vite-runtime.spec.ts`](../e2e/vite-runtime.spec.ts) proves official Vite and unscoped plugin
  manifest loading.
- [`e2e/originjs-runtime.spec.ts`](../e2e/originjs-runtime.spec.ts) proves the OriginJS ESM entry,
  host services, lifecycle, and generated shared fallback.
- [`e2e/vertical-slice.spec.ts`](../e2e/vertical-slice.spec.ts) proves the official Rsbuild React,
  Vue, and iframe paths.

## Related documentation

- [Architecture](architecture.md)
- [Application contract](application-contract.md)
- [Resolution and delivery](resolution-and-delivery.md)
- [Operations](operations.md)

# Citations

- [Official Module Federation Runtime API](https://module-federation.io/guide/runtime/runtime-api)
- [Official manifest and snapshot guide](https://module-federation.io/guide/basic/manifest-snapshot)
- [Official Module Federation Vite plugin](https://github.com/module-federation/vite)
- [`vite-plugin-federation`](https://github.com/jskits/vite-plugin-federation)
- [OriginJS Vite federation plugin](https://github.com/originjs/vite-plugin-federation)
