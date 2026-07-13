---
type: contract
title: Support Policy
description: Declared package, runtime, framework, browser, module-format, and prerelease support boundaries for Fronts 2.0.
owner: unadlib/fronts maintainers
status: proposed
tags: [support, compatibility, versions, browsers]
---

# Support policy

## Purpose

This document separates declared compatibility from environments that the repository actually
verifies. A peer range is a consumer contract; a single green fixture is evidence for one point in
that range, not proof of every combination.

Fronts 2.0 is currently unpublished prerelease software. Until a stable release is published, public
APIs, package boundaries, and protocols may change. Every user-visible package change still requires
a Changeset so release notes expose that movement.

Exact ranges in package manifests remain authoritative. This document defines how to interpret and
verify them.

## Support vocabulary

| Term             | Meaning                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Declared support | The environment is inside a published package engine or peer range. Regressions are treated as Fronts issues. |
| CI-verified      | The repository runs its required build, package, test, or browser gate in that environment.                   |
| Fixture-verified | One checked-in integration combination passes, but adjacent versions or modes are not implied.                |
| Best effort      | The environment may work and issue reports are useful, but it has no maintained verification gate.            |
| Unsupported      | The environment is outside package contracts or contradicts a documented runtime boundary.                    |

An environment is not CI-verified merely because its JavaScript engine implements the required Web
APIs. New support claims require a repeatable repository check.

## Package and toolchain support

| Surface                    | Declared boundary                         | Current verification                                         | Notes                                                                 |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| Public package Node engine | Node `>=22.18.0`                          | `pnpm check` on Node 22 and 24                               | Applies to package installation/import and repository tooling.        |
| Repository package manager | pnpm `>=10 <12`                           | Workspace pinned to pnpm 10                                  | Consumer projects do not need pnpm unless their own setup chooses it. |
| JavaScript output          | ES2022, ESM and CommonJS                  | Build plus isolated tarball imports of every public entry    | Fronts ships no legacy-browser polyfill bundle.                       |
| TypeScript declarations    | Declarations emitted for ESM and CommonJS | Workspace typecheck with the pinned compiler                 | No minimum consumer TypeScript matrix is currently claimed.           |
| Module Federation runtime  | `@module-federation/runtime` `^2.7.0`     | Adapter unit tests and real-runtime HTTP integration         | `@fronts/mf` requires an explicit official runtime instance.          |
| React adapter              | React and React DOM `>=18.2.0 <20`        | Contract tests and examples with the workspace React version | Minimum React 18.2 is declared but not separately matrix-tested.      |
| Vue adapter                | Vue `>=3.4.0 <4`                          | Contract tests and examples with the workspace Vue version   | Minimum Vue 3.4 is declared but not separately matrix-tested.         |

Verification sources:

- root and package [`package.json`](../package.json) files own engine and peer ranges;
- package [`tsdown.config.ts`](../packages/core/tsdown.config.ts) files own output target and formats;
- [CI](../.github/workflows/ci.yml) owns the Node and browser gate matrix;
- [`verify-packages.mjs`](../scripts/verify-packages.mjs) owns tarball contents and ESM/CommonJS
  consumer smoke tests.

### TypeScript compatibility

Fronts publishes declarations but does not currently run a consumer compiler-version matrix.
Consumers using a compiler older than the repository version must validate the packed declarations
in their own build. A minimum supported consumer compiler MUST NOT be advertised until CI installs
and typechecks a tarball consumer with that version.

Verification: Missing — minimum consumer TypeScript version matrix.

### Framework range verification

React 18.2 and Vue 3.4 are valid peer boundaries in the package manifests, but the regular suite
installs one workspace version of each framework. Before stable, the release gate SHOULD add focused
minimum-version jobs or narrow the peer ranges to the versions continuously tested.

Verification: Missing — explicit React 18.2 and Vue 3.4 minimum-version jobs.

## Browser support

Fronts is a browser application runtime. The required production browser baseline must provide the
features used by the chosen path:

| Path               | Required platform capabilities                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Core Host          | ES2022, DOM, `AbortController`, `Proxy.revocable`, promises, modules/bundler output.                                 |
| Shadow container   | Shadow DOM and `ShadowRoot`.                                                                                         |
| Iframe integration | Cross-origin iframe sandbox, `postMessage`, transferable `MessagePort`, structured clone, and `crypto.randomUUID()`. |
| Framework adapters | Browser features required by the selected supported React or Vue version.                                            |

Current CI installs and runs Playwright Chromium only. Therefore:

- Chromium is the only CI-verified browser engine.
- Firefox and WebKit are best effort until the same lifecycle, replacement, service, Shadow DOM,
  and iframe E2E suite is required for those Playwright projects.
- Mobile browsers and embedded WebViews are not currently claimed.
- Internet Explorer and legacy non-ES2022 browsers are unsupported.
- No Fronts polyfills are shipped; a consumer may transpile or polyfill its own application, but it
  must not weaken security requirements such as exact iframe origins or secure channel IDs.

Verification: Missing — required Firefox and WebKit browser projects.

## Runtime environments

| Environment                   | Status         | Boundary                                                                           |
| ----------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| Browser shell with DOM        | Primary target | Chromium is CI-verified; engine coverage is defined above.                         |
| Node ESM/CommonJS import      | CI-verified    | Public entries import without mounting browser containers.                         |
| Server-side rendering         | Unsupported    | Fronts does not define server rendering, hydration, or server lifecycle semantics. |
| Web Worker / Service Worker   | Unsupported    | No DOM container or worker application contract exists.                            |
| Deno or Bun as build runtime  | Best effort    | No engine declaration or CI job.                                                   |
| React Native / native WebView | Unsupported    | No native target/container contract or mobile E2E gate.                            |

Protocol validation, resolver helpers, and other neutral utilities may execute outside a browser,
but that does not turn those environments into supported Host mount targets.

## Module Federation producer support

Producer compatibility is defined separately in
[Module Federation integrations](module-federation-integrations.md). In summary:

- official Rsbuild and official Vite producers are the preferred integration paths;
- the unscoped `vite-plugin-federation` path is verified producer compatibility;
- OriginJS is a narrow production ESM fixture on its checked-in Vite 5.4 pipeline;
- the Fronts Host uses an explicit official MF runtime instance for all MF paths;
- a producer plugin's peer range or README does not automatically become a Fronts support claim.

Any new producer or version claim MUST add a fixture that proves full application lifecycle,
services, cleanup, and shared behavior where applicable.

## Public package contract

Only package `exports` are supported entry points:

- `@fronts/core`
- `@fronts/core/iframe`
- `@fronts/mf`
- `@fronts/react`
- `@fronts/vue3`

Deep imports into `dist`, `src`, `runtime-core`, or another package's private files are unsupported.
Both ESM import and CommonJS require are package gates. The four public packages use synchronized
versions through a fixed Changesets group.

The application and iframe protocol versions are runtime compatibility gates. Producers and Hosts
MUST use protocol-compatible Fronts packages; bypassing protocol validation or forging branded
objects is unsupported.

## Prerelease and stable compatibility

### Before 2.0 stable

- Breaking API and protocol changes may occur between prereleases.
- All four public package versions move together.
- Consumers SHOULD pin an exact prerelease or use a controlled lockfile rather than an open range.
- A production adopter MUST test its exact Host, producer, browser, and deployment-policy
  combination before rollout.
- The npm `next` tag will identify prereleases after first publication; no Fronts 2.0 package is
  currently published.

### Stable acceptance gates

The `latest` tag MUST NOT be published until all of these are true:

1. the public protocol and entry points have an accepted compatibility review;
2. package tarballs pass ESM, CommonJS, declaration, and public-subpath consumer checks;
3. every declared minimum framework/runtime range is continuously verified or narrowed;
4. the supported browser matrix is explicit and green;
5. iframe origin, capability, cancellation, timeout, and cleanup tests are required;
6. production-preview E2E covers all supported producer tiers;
7. release provenance, rollback, and vulnerability-reporting procedures are operational.

After stable, semantic versioning SHOULD govern supported public exports and protocol changes:
compatible additions in minor releases, fixes in patch releases, and breaking contracts only in a
new major. This stable commitment remains proposed until the maintainers accept this policy before
the first `latest` release.

## Reporting a compatibility problem

An actionable report should include:

- Fronts package versions and package manager lock information;
- Node, browser engine/version, framework, MF runtime, and producer plugin versions;
- manifest versus raw-entry mode and remote entry type;
- development versus production-preview behavior;
- the smallest `AppRef`, resolved source, and container type that reproduce the issue;
- Fronts error `code`, `phase`, Host event trace, and redacted MF loading trace;
- whether unmount followed by `host.audit()` is idle;
- a minimal repository or failing test when possible.

Security reports MUST follow [SECURITY.md](../SECURITY.md) rather than being posted as a public
compatibility issue.

## Verification

- `pnpm check` verifies formatting, builds, tarball consumption, types, unit/integration tests, and
  coverage on the Node versions configured in CI.
- `pnpm test:e2e:preview` rebuilds and verifies the current producer matrix in Chromium.
- [`packages/mf/test/runtime-integration.test.ts`](../packages/mf/test/runtime-integration.test.ts)
  loads a real remote container through the official runtime.
- [`e2e`](../e2e) contains the browser evidence for core-only, framework, container, and Vite
  producer paths.
- Missing matrices are stated above and MUST NOT be represented as CI-verified support.

## Related documentation

- [Releasing](releasing.md)
- [Module Federation integrations](module-federation-integrations.md)
- [Iframe deployment](iframe-deployment.md)
- [Operations](operations.md)
