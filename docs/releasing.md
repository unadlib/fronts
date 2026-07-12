# Releasing

Fronts publishes four public packages with synchronized versions:

- `@fronts/core`
- `@fronts/mf`
- `@fronts/react`
- `@fronts/vue3`

The repository is currently in Changesets prerelease mode with npm tag `next`.

## Add a change

Every user-visible package change needs a changeset:

```sh
pnpm changeset
```

Choose the affected packages and semantic impact. Because the packages are a fixed group,
Changesets keeps their public versions synchronized while the protocol is stabilizing.

## Local release verification

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test:e2e
```

`pnpm check` performs formatting/lint, a topological clean build, tarball consumption checks,
TypeScript checks, all unit/integration tests, and enforced coverage thresholds.

`pnpm verify:packages` packs each public workspace, rejects missing README/LICENSE/dist or leaked
source/test directories, installs the four tarballs in an isolated temporary consumer, and imports
every public entry through both ESM and CommonJS.

## Automated flow

Pushes to `master` run the Changesets action. It either:

1. opens/updates a release PR containing version and changelog changes; or
2. after that PR is merged, runs `pnpm release` and publishes pending packages.

The GitHub environment should be configured as an npm trusted publisher for this repository and
the exact `release.yml` workflow filename. The workflow uses Node 24, upgrades npm to a version
with OIDC support, grants `id-token: write`, disables the release dependency cache, and requests
npm provenance.

Trusted publishing can only be configured after a package exists. Before the first release:

1. confirm the publisher owns the npm `@fronts` scope;
2. add a short-lived granular npm token as the `NPM_TOKEN` repository secret;
3. publish the first prerelease through the protected workflow;
4. configure all four packages to trust `unadlib/fronts` + `release.yml` for `npm publish`;
5. delete the `NPM_TOKEN` secret and revoke the bootstrap token.

After bootstrap, the empty token environment values fall through to npm's short-lived OIDC
credential. Do not retain a long-lived publish token as a permanent fallback.

Protect `master` so the Node 22/24 checks and Chromium E2E job are required before merging the
release PR.

## Leaving prerelease mode

After the protocol has met the stable compatibility criteria:

```sh
pnpm changeset pre exit
pnpm version-packages
```

Review the resulting stable versions and changelogs in a pull request. Do not publish `latest`
until compatibility, security, browser, package-consumer, and rollback gates have passed on the final
candidate.
