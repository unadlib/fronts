# Fronts 1.0 documentation

This index is the canonical entry point for the current Fronts 1.0 documentation. The public
TypeScript declarations remain authoritative for exact signatures; these documents explain intent,
ownership boundaries, invariants, operating procedures, and verification.

Typed composition shortcuts are accepted for the 1.0 alpha. Other concept
documents currently use `status: proposed`: they reflect the implemented and tested repository
state but still require explicit maintainer acceptance before becoming stable compatibility or
policy commitments.

## Understand the runtime

1. [Architecture](architecture.md) — layers, dependency direction, ownership, transactions, and
   extension points.
2. [Application contract](application-contract.md) — the framework-neutral application ABI,
   lifecycle, readiness, and services.
3. [Host Runtime API](host-runtime-api.md) — Host composition, operations, mounted controls,
   replacement, observability, and shutdown.
4. [Composition shortcuts](composition-shortcuts.md) — typed factories that separate transport
   composition from React and Vue rendering bindings.

## Resolve, deliver, and isolate applications

- [Resolution and delivery](resolution-and-delivery.md) — registry policy, caches, immutable
  deployments, preload, promotion, and rollback.
- [Module Federation integrations](module-federation-integrations.md) — official Runtime ownership,
  producer compatibility tiers, and tested bundler boundaries.
- [Isolation and security](isolation-and-security.md) — DOM, Shadow DOM, iframe, trust, and capability
  boundaries.
- [Iframe deployment](iframe-deployment.md) — cross-origin agent wiring, CSP, capability negotiation,
  timeouts, and lifecycle cleanup.

## Operate and release Fronts

- [Runtime operations](operations.md) — telemetry, failures, replacement, timeouts, tests, and
  incident correlation.
- [Support policy](support-policy.md) — declared, CI-verified, fixture-verified, best-effort, and
  unsupported environments.
- [Troubleshooting](troubleshooting.md) — phase-oriented diagnosis and recovery.
- [Releasing](releasing.md) — Changesets, package verification, npm provenance, and release gates.

Repository-wide workflow and disclosure policies live at the root:

- [Contributing](../CONTRIBUTING.md) — setup, change workflow, tests, documentation, and review.
- [Security policy](../SECURITY.md) — vulnerability scope, reporting, and disclosure handling.

## Maintenance rules

- Update behavior and its affected documentation in the same concern commit.
- Add every new concept document to this index and give it a concrete `## Verification` section.
- Use `status: proposed` for unresolved or unreviewed commitments; only a responsible maintainer may
  accept them.
- Run `pnpm docs:check` after changing Markdown. The repository check also runs it through
  `pnpm lint`.
