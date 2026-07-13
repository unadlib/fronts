# Fronts documentation website

This workspace builds the bilingual [fronts.js.org](https://fronts.js.org/) documentation with
Fumadocs, Next.js static export, and browser-side Orama search. It does not require a server at
runtime and is deployed as one root commit on `gh-pages`.

## Content ownership

- English technical pages are generated from canonical repository documents and public package
  READMEs listed in [`content/content-map.json`](content/content-map.json).
- The English introduction, quick start, and the two canonical pages whose source is not structured
  as a complete website article are maintained under [`content/authored/en`](content/authored/en).
- Every English slug has a manually maintained Chinese counterpart under
  [`content/authored/zh`](content/authored/zh).
- `content/docs` is generated and ignored. Never edit it directly.
- Exact API signatures and dependency ranges remain authoritative in package source and manifests.

When adding a canonical document, add its English source and Chinese counterpart to the content
map. The content check rejects missing canonical docs, missing locale pairs, incomplete pages,
broken localized links, and Chinese pages that point back into the English tree.

## Local development and verification

From the repository root:

```sh
pnpm dev:website
pnpm website:build
pnpm website:check
```

`website:check` regenerates content, typechecks MDX and Next routes, creates a fresh static export,
verifies every localized route and local asset, checks revision metadata and both search indexes,
then runs Chromium E2E against `website/out`.

The root language selector is `/`; localized home pages are `/en/` and `/zh/`; documentation is
under `/en/docs/` and `/zh/docs/`. Explicit routes are used so static GitHub Pages hosting does not
depend on middleware, cookies, redirects, or server-side locale negotiation.

## Deployment

Only a clean, pushed `main` commit can deploy:

```sh
pnpm website:deploy
```

The script runs the complete website check by default, fetches the current `gh-pages` branch,
preserves its `CNAME` byte-for-byte, creates a parentless deployment commit containing only the
static export plus `CNAME` and `.nojekyll`, and pushes with an exact `force-with-lease`. It then
confirms the remote commit and waits until the custom domain serves the source revision embedded in
the HTML.

Useful automation-only switches are `--skip-check`, `--skip-online-verification`, and `--dry-run`.
The [documentation workflow](../.github/workflows/docs.yml) runs the full check before invoking the
script with `--skip-check`; package publication remains independently sourced from `master`.

The deployment contract and recovery procedure are recorded in the
[website feature specification](../docs/features/documentation-website/spec.md) and
[static Pages ADR](../docs/adr/0002-fumadocs-static-pages.md).
