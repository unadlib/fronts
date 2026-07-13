---
type: feature-spec
title: Bilingual documentation website
description: Content, static-export, search, verification, and deployment contract for fronts.js.org.
owner: unadlib/fronts maintainers
status: proposed
risk_level: high
tags: [documentation, website, internationalization, github-pages]
---

# Bilingual documentation website

## Problem and outcome

The repository's canonical Markdown is complete enough for maintainers but does not provide a
searchable, navigable, bilingual reader experience. The previous `gh-pages` site is an obsolete
Docusaurus build and is not generated from the current Fronts 2.0 contracts.

The outcome is a Fumadocs website sourced on `main`, statically exported, and published at
`https://fronts.js.org/`. It presents the current application ABI, Host Runtime, Module Federation
boundary, isolation model, package guides, operations, compatibility policy, troubleshooting,
contribution, release, and security guidance in English and Chinese.

## Content contract

[`website/content/content-map.json`](../../../website/content/content-map.json) is the inventory.
Every slug has exactly one English and one Chinese page. Canonical English technical content is
synchronized from repository documents and public package READMEs; authored English overrides are
allowed only when a canonical source is not a complete English website article. Chinese pages are
maintained explicitly rather than machine-falling back to English.

Generated `website/content/docs` is disposable and ignored. Source documents remain authoritative
for precise APIs, package exports, engine ranges, and peer dependencies. Website generation may
rewrite repository-relative links to localized routes or immutable GitHub `main` links, but it must
not invent a second API contract.

## Reader contract

- `/` offers explicit English and Chinese entry points.
- `/en/` and `/zh/` are localized product overviews.
- `/en/docs/` and `/zh/docs/` expose parallel navigation trees with trailing-slash-compatible URLs.
- Each article publishes canonical and alternate-language metadata.
- English search uses the static Orama index; Chinese search uses the Mandarin tokenizer.
- Mermaid diagrams render client-side without requiring a documentation server.
- Each application HTML page embeds the complete source Git revision as `fronts-revision` metadata.
- The layout links back to the corresponding source file on the repository's `main` branch.

The site does not silently redirect by cookie or browser language. Explicit locale routes keep the
export deterministic on GitHub Pages and make shared links stable.

## Acceptance criteria

1. Content generation produces 22 English/Chinese page pairs and rejects any unmapped canonical
   document anywhere below `docs`.
2. Every localized page has title, description, source path, substantial content, and multiple
   sections; the Chinese tree contains Chinese content and no `/en/docs` links.
3. A clean `next build` exports the root, both homes, all 40 documentation routes, and static search.
4. Static output validation proves all expected routes and local assets exist, each application
   page has the correct HTML language and source revision, and both search indexes contain the Host
   Runtime guide.
5. Chromium E2E proves the language selector, both documentation roots, a deep runtime article, and
   English and Mandarin search.
6. Deployment is allowed only from a clean `main` commit equal to `origin/main`.
7. Deployment preserves the existing `gh-pages:CNAME` byte-for-byte and publishes the export plus
   `.nojekyll` in a commit with no parent.
8. The branch update uses an exact force lease, verifies the resulting remote SHA, and succeeds only
   after the custom domain serves the embedded source revision.

## Rollout and rollback

The initial rollout replaces the previous `gh-pages` history only after local verification and a
successful push of `main`. The deploy script records both the prior branch SHA and the new root
deployment SHA in command output. GitHub Pages continues using the existing custom domain because
the original CNAME blob is preserved exactly.

For a documentation regression, fix or revert the source commit on `main` and redeploy, producing a
new verified root commit. For an urgent serving failure before that fix is available, a maintainer
may rebuild a known-good `main` revision and push its root deployment commit using an exact lease.
Do not restore the obsolete Docusaurus tree as the normal rollback path.

## Risks and reviewer focus

The destructive branch rewrite and public-domain update are high-risk external effects. Reviewers
must check the source revision, branch lease, exact CNAME bytes, root-commit parent count, static
tree inventory, custom-domain response, and whether repository Pages settings still publish
`gh-pages` from `/`.

Content risks are stale source mapping, English fallback presented as Chinese, broken generated
links, and unsupported compatibility claims. The automated inventory, localized link checks,
static search checks, browser E2E, and support-policy language reduce those risks; maintainers still
own technical translation review.

## Verification

```sh
pnpm docs:check
pnpm website:check
node --check scripts/deploy-website.mjs
pnpm website:deploy -- --dry-run --skip-check --skip-online-verification
```

After an authorized deployment, verify `origin/gh-pages` has no parent, contains the exact CNAME,
and `https://fronts.js.org/en/docs/` exposes the `main` source revision. The deployment script
performs those remote and online checks; a maintainer must review repository Pages settings and the
public rendering after the first rollout.
