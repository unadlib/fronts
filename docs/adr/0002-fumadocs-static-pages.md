---
type: adr
title: Fumadocs static website on GitHub Pages
description: Decision to build explicit bilingual static routes on main and replace gh-pages with one generated root commit.
owner: unadlib/fronts maintainers
status: proposed
risk_level: high
tags: [documentation, fumadocs, nextjs, github-pages, deployment]
---

# Fumadocs static website on GitHub Pages

## Context

Fronts needs current English and Chinese documentation without coupling package publication to a
documentation server. The custom domain already points at GitHub Pages, but the existing branch
contains a six-year-old Docusaurus artifact. The repository's package release workflow still uses
`master`, while the requested website source branch is `main`.

The site needs nested technical navigation, MDX, diagrams, source links, localized search, static
hosting, deterministic deployment, and a way to prove which source commit is online.

## Decision

Use Fumadocs with Next.js `output: 'export'`. Source lives in the `website` pnpm workspace on
`main`; package publication remains on `master`. Routes use explicit `/en` and `/zh` prefixes with
directory-based content parsing and no locale fallback. Search is a generated static Orama endpoint,
with the Mandarin tokenizer for Chinese.

Publish `website/out` to `gh-pages` as a new parentless commit on every deployment. Preserve the
current `CNAME` blob exactly, add `.nojekyll`, and push with `force-with-lease` tied to the fetched
remote SHA. Embed the full `main` Git revision in every application page and poll the custom domain
until that revision appears.

## Alternatives considered

- Keep the previous Docusaurus output: rejected because its content and build provenance no longer
  represent Fronts 2.0.
- Keep authored English and Chinese copies for every page: rejected for canonical English contracts
  because duplication would drift; source mapping plus explicit Chinese pages makes ownership clear.
- Infer locale with middleware, cookies, or redirects: rejected because static GitHub Pages cannot
  provide a reliable server negotiation layer and explicit URLs are easier to cache and share.
- Publish through a persistent `gh-pages` history: rejected because generated history has no review
  value; the reviewed source history is on `main`, while one root commit proves the exact live tree.
- Use only a Pages artifact deployment: rejected for this repository because the requested contract
  explicitly retains a `gh-pages` CNAME and branch-visible static output.
- Add the website to the package release branch/workflow: rejected because documentation deployment
  and npm publication have different permissions, rollback, and release cadence.

## Consequences

The website is serverless after export, keeps the current custom domain, and can be reproduced from
one reviewed source commit. English canonical changes automatically reach the generated tree, while
Chinese translations remain an explicit review responsibility. A separate workflow can verify and
deploy docs without widening npm release permissions.

The generated branch is intentionally rewritten, so it is not a durable rollback history. Recovery
means rebuilding a known-good `main` revision and publishing another root commit. Search and Mermaid
must remain compatible with static export. Adding a language requires content inventory, tokenizer,
navigation, metadata, output checks, and browser evidence rather than only a locale label.

## Security and operations

The deploy script refuses dirty, unpushed, or non-`main` sources. Its exact lease prevents silently
overwriting a concurrent Pages update. It reads CNAME from the currently fetched remote commit and
compares the new blob byte-for-byte before push. The GitHub workflow receives only `contents: write`;
it does not receive npm OIDC or release secrets.

Online revision polling distinguishes a successful Git push from a successful Pages publication.
The first rollout still requires human review of Pages branch/root settings, domain/TLS state, the
root commit, language navigation, and public article rendering.

## Verification

- `pnpm website:check` verifies content, MDX/TypeScript, static export, links, assets, search, and
  browser behavior.
- [`scripts/deploy-website.mjs`](../../scripts/deploy-website.mjs) verifies branch/source state,
  CNAME preservation, parentless commit construction, exact lease, remote SHA, and online revision.
- [`.github/workflows/docs.yml`](../../.github/workflows/docs.yml) executes the checked deployment
  from `main` with Node 24 and Chromium.
- [`website/README.md`](../../website/README.md) documents local ownership and operator commands.
- Verification of repository Pages settings and custom-domain TLS remains an external human check.
