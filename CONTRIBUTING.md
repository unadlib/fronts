---
type: operations
title: Contributing to Fronts
description: Development setup, change boundaries, testing, documentation, Changesets, and review expectations for Fronts contributors.
owner: unadlib/fronts maintainers
status: proposed
tags: [contributing, development, testing, changesets]
---

# Contributing to Fronts

## Development prerequisites

- Node.js 22.18 or newer;
- pnpm 10 or 11 through Corepack;
- a Chromium installation managed by Playwright for browser E2E;
- macOS, Linux, or another environment capable of running the repository's Node and browser tools.

The root [`package.json`](package.json) is the source of truth for engines and the pinned package
manager. CI runs the main check on Node 22 and 24.

```sh
corepack enable
pnpm install --frozen-lockfile
```

Do not replace pnpm with npm or Yarn when changing the workspace lockfile.

## Repository map

| Area             | Responsibility                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `packages/core`  | Application protocol, Host, resolvers, containers, services, errors, and iframe transport. |
| `packages/mf`    | Adapter over the public official Module Federation runtime instance API.                   |
| `packages/react` | React producer and Host adapter for the Fronts application contract.                       |
| `packages/vue3`  | Vue 3 producer and Host adapter for the same contract.                                     |
| `examples`       | Executable core-only, framework, iframe, Rsbuild, and Vite integration evidence.           |
| `e2e`            | Playwright behavior shared by development and production-preview server modes.             |
| `docs`           | Architecture, contracts, operations, support boundaries, and runbooks.                     |
| `.changeset`     | Pending public-package release notes and prerelease state.                                 |

Read [Architecture](docs/architecture.md) and the
[Application contract](docs/application-contract.md) before changing package boundaries or
lifecycle semantics.

## Change workflow

1. Start from an up-to-date branch and confirm the worktree contains no changes you do not own.
2. Reproduce the behavior or define the contract before editing implementation.
3. Change one concern at a time and add the narrowest test that proves it.
4. Update every affected public README, contract, architecture document, runbook, and example.
5. Add a Changeset when a published package changes for consumers.
6. Run focused checks while iterating, then the complete required gates.
7. Review the diff for unrelated formatting, generated artifacts, secrets, and accidental public API
   expansion.

Keep commits focused. One independently reviewable concern per commit is preferred. Existing history
uses Conventional Commit-style subjects such as:

```text
fix(core): revoke late service scopes
feat(mf): support a public runtime option
test(examples): cover a producer path
docs: define browser support
```

Do not rewrite or discard another contributor's worktree changes. Do not commit build output,
Playwright reports, coverage output, package tarballs, or local environment files unless a task
explicitly changes their source-controlled policy.

## Changesets

Every consumer-visible change to one or more public packages needs a Changeset:

```sh
pnpm changeset
```

Select all affected packages and describe user impact rather than implementation detail. The four
public packages are a fixed Changesets group, so versioning remains synchronized while the 2.0
contract stabilizes.

Typical Changeset decisions:

| Change                                                                                      | Changeset?                                           |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Public runtime behavior, error, export, type, peer range, package metadata, or security fix | Yes                                                  |
| Internal refactor with identical published behavior                                         | Usually no; add one if consumers can observe it      |
| Test-only or example-only verification                                                      | No, unless it accompanies a package behavior change  |
| Documentation-only correction outside packed package READMEs                                | No                                                   |
| Public package README change that affects consumer guidance                                 | Yes when released package content changes materially |

Do not edit package versions or changelogs by hand. The Changesets release flow owns them.

## Focused development commands

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

Run a focused Vitest file while iterating:

```sh
pnpm exec vitest run packages/core/test/host.test.ts
pnpm exec vitest run packages/core/test/iframe.test.ts
pnpm exec vitest run packages/mf/test
```

Run the complete non-browser gate before handoff:

```sh
pnpm check
```

`pnpm check` runs formatting/lint, a clean topological build, isolated packed-package consumption,
TypeScript checks, unit/integration tests, and coverage thresholds. Do not treat a focused test as
evidence that the repository gate passes.

## Browser E2E

Install the configured Chromium binary once:

```sh
pnpm exec playwright install chromium
```

Development-server mode:

```sh
pnpm test:e2e
```

Fresh production build and preview mode:

```sh
pnpm test:e2e:preview
```

CI requires the production-preview path. Run both when changing Host orchestration, remote output,
asset URLs, manifests, shared dependencies, iframe behavior, framework adapters, or example server
configuration.

The current server map is owned by [`e2e/playwright-config.ts`](e2e/playwright-config.ts):

- `4100`–`4103`: React Host, React remote, Vue remote, and iframe agent;
- `4110`: core-only Host;
- `4200`–`4203`: plain Vite Host and the official, unscoped, and OriginJS producers.

The OriginJS workspace's `dev` command intentionally builds and previews its remote. It does not
provide a bundleless remote dev mode.

## Adding or changing public APIs

A public API change is incomplete until all applicable evidence exists:

1. implementation and types are exported only through an intended package `exports` entry;
2. unit/contract tests cover success, failure, cancellation, and cleanup;
3. package README and the relevant contract guide explain intent and boundaries;
4. runtime identifiers, input envelopes, and extension contexts follow existing validation and
   snapshot rules;
5. ESM and CommonJS packed-package imports still pass;
6. a Changeset records consumer impact;
7. compatibility and rollback implications are reviewed before stable.

Avoid adding a convenience API that bypasses the Host transaction. Standalone development should
compose a normal Host with a static resolver and local loader so readiness, services, cancellation,
and cleanup remain identical to production.

## Module Federation changes

`@fronts/mf` MUST remain an adapter over public official runtime instance methods. It must not:

- parse or mutate MF manifests/snapshots;
- import private `runtime-core` internals;
- implement shared dependency selection;
- discover or mutate a hidden global default instance;
- add bundler-specific behavior to `@fronts/core`.

When adding a producer compatibility claim, follow the acceptance checklist in
[Module Federation integrations](docs/module-federation-integrations.md). A load-only smoke test is
insufficient: prove readiness, services, update, unmount, idle audit, production output, and shared
behavior where applicable.

## Iframe and capability changes

Iframe, identity, capability, and service-scope changes are security-sensitive. Preserve these
invariants:

- exact origins; never `targetOrigin="*"`;
- dedicated child origin with the required sandbox tokens;
- validation of both message origin and expected source window;
- random channel ID and exactly one transferred port;
- final grant as the intersection of proxy maximum, Host-authorized services, and child declaration;
- parent-side validation on every privileged call;
- revocation on abort/unmount and deterministic provider, peer, agent, and container cleanup.

Run the complete iframe tests and cross-origin browser E2E. Review
[Iframe deployment](docs/iframe-deployment.md),
[Isolation and security](docs/isolation-and-security.md), and [SECURITY.md](SECURITY.md). Security
reports must not be moved into a public issue or normal pull request before coordinated disclosure.

## Documentation changes

Documentation should capture intent, ownership boundaries, invariants, trade-offs, and verification
paths rather than restating implementation line by line.

For a new concept document under `docs`:

- add YAML frontmatter with `type`, `title`, `description`, `owner`, and `status`;
- use `status: proposed` until maintainers accept new policy or design commitments;
- link source types/tests instead of copying volatile field lists and defaults;
- include a `## Verification` section with commands or explicit missing evidence;
- add it to the root README documentation index;
- use Mermaid only when it materially clarifies a boundary, sequence, lifecycle, or decision tree;
- run Prettier and verify every relative link resolves.

Update documentation in the same concern commit as the behavior that makes it stale. Do not add
pre-2.0 migration or compatibility material to current Fronts 2.0 documentation.

## Pull request checklist

- [ ] The change has one clear responsibility and no unrelated worktree edits.
- [ ] Public behavior has focused success, failure, cancellation, and cleanup evidence.
- [ ] `pnpm check` passes.
- [ ] Relevant development and production-preview E2E pass.
- [ ] Public package changes include a Changeset.
- [ ] READMEs, contracts, support tables, and runbooks match the new behavior.
- [ ] New producer claims state their exact tested boundary.
- [ ] Security-sensitive changes received explicit human review.
- [ ] Logs, fixtures, screenshots, and reports contain no credentials or tenant-sensitive data.
- [ ] The commit history is focused and reviewable.

## Reporting problems

Use GitHub issues for reproducible bugs, documentation gaps, and feature proposals. Include the
diagnostic evidence requested by [Troubleshooting](docs/troubleshooting.md) and
[Support policy](docs/support-policy.md).

Do not report vulnerabilities publicly. Follow [SECURITY.md](SECURITY.md).

## Verification

- [`package.json`](package.json) owns required commands, engines, and package-manager configuration.
- [CI](.github/workflows/ci.yml) owns the Node and Chromium release gates.
- [Releasing](docs/releasing.md) owns Changesets, prerelease, provenance, and publication flow.
- `pnpm check` is the complete local non-browser gate.
- `pnpm test:e2e` and `pnpm test:e2e:preview` prove development and built example composition.
