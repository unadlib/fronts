# Operations

## Observability model

Every host has a `hostId`; every application has an `instanceId` and `traceId`. Host events carry a
monotonic sequence number, timestamp, current snapshot, and state duration. Errors additionally
carry a stable Fronts error code and phase.

Phases are deliberately application-oriented:

- resolve
- load
- validate
- prepare
- mount
- ready
- update
- activate/deactivate
- unmount
- replace/audit

Module Federation runtime hooks provide lower-level manifest, remote entry, expose, shared, and
resource events. Correlate the two streams at the `@fronts/mf` load boundary; do not duplicate all
MF hook payloads into core. The official [runtime hooks](https://module-federation.io/guide/runtime/runtime-hooks)
and DevTools loading trace remain the source of truth for MF internals.

## Subscribing

Provide an initial observer or subscribe later:

```ts
const host = createFrontsHost({
  // ...
  observer(event) {
    telemetry.emit('fronts.lifecycle', event);
  },
});

const unsubscribe = host.subscribe((event) => {
  if (event.kind === 'error') reportError(event.error, event);
});
```

Observers must be non-blocking and must not throw. Ship events to a buffered telemetry client and
redact application props, service arguments, URLs with credentials, and tenant-sensitive metadata.

## Recommended metrics

- resolution latency and failures by app/channel/environment;
- MF load/preload latency and cache outcome;
- mount-to-ready latency and readiness timeouts;
- update/activate/deactivate latency and failures;
- replacement success, rollback, and previous cleanup failure;
- active instances by app/version/container;
- stale resolver cache use;
- denied capability count;
- iframe handshake/RPC timeout and origin rejection;
- retained containers and non-idle host audits.

Do not use high-cardinality instance/trace IDs as metric labels. Keep them in traces/logs.

## Failure semantics

Fronts wraps failures in `FrontsError` with:

- stable code for programmatic handling;
- phase for ownership and alert routing;
- cause for diagnostics;
- structured details that avoid parsing messages.

Expected policy:

| Failure                               | Host behavior                                                              |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Resolution/registry failure           | Use configured cached/fallback resolver or reject mount                    |
| MF load failure                       | Roll back acquired resources; current replacement target remains active    |
| Invalid application protocol          | Reject before mount                                                        |
| Container preparation failure         | Revoke services and reject                                                 |
| Mount/ready failure or timeout        | Unmount if possible, dispose container, revoke scope                       |
| Update failure                        | Instance remains mounted but failure is surfaced; product chooses recovery |
| Replacement staging failure           | Destroy staging and retain current instance                                |
| Previous cleanup failure after commit | Return `previousCleanupError`; new instance remains committed              |
| Observer failure                      | Runtime continues; observer is not part of the transaction                 |

## Audit and shutdown

`host.inspect()` returns immutable instance snapshots. `host.audit()` reports:

- active/non-destroyed instances;
- pending operations;
- replacement transactions;
- retained owned containers;
- overall `idle` state.

Use `host.assertIdle()` after tests, route teardown, or shell shutdown. A failure is evidence of an
application/container lifecycle leak and should fail CI.

```ts
await host.dispose();
host.assertIdle();
```

`dispose()` aborts/unmounts instances and releases host resources. Transport-specific objects with
their own lifetime, such as a legacy script loader, should also be disposed by the composition
root.

## Replacement runbook

1. Confirm registry response and immutable artifact availability for old and new deployment.
2. Preload the target when useful; do not treat preload success as application readiness.
3. Call `replace()` with a fresh resolution context and stable product trace.
4. Alert on staging resolve/load/mount/ready failure; the old instance should remain active.
5. If commit succeeds with `previousCleanupError`, serve the new instance but investigate the leak.
6. Confirm audit has no retained old container after cleanup.
7. If product validation fails after readiness, point the registry channel back and replace again;
   Fronts cannot infer business correctness from render readiness.

## Timeouts

- Timeout values must be finite and non-negative; `0` disables the corresponding deadline while
  `AbortSignal` cancellation remains active.
- Set readiness deadlines from real application SLOs, not an unlimited default.
- Keep iframe handshake and RPC deadlines finite.
- Pass abort signals through registry fetch and custom loaders.
- A timeout is a failure and triggers cleanup; it must never leave a hidden staging app active.

## Testing strategy

The repository uses four layers:

1. unit tests for protocol, resolver, service scope, adapters, and error behavior;
2. host contract tests for lifecycle transitions, cancellation, replacement, and audit;
3. a real MF Runtime integration test serving a real remote container over HTTP;
4. browser E2E for the five-service React/Vue/iframe/legacy vertical slice.

Mocks are appropriate for error matrices, but at least one runtime test must execute the official
MF instance. Official MF also recommends real-runtime integration/E2E testing to avoid a false
gap between bundler fixtures and production behavior.

## Incident correlation

Record these fields together when available:

```text
hostId, traceId, instanceId, app name, resolved version, expose,
container type, registry deploymentId/policy revision,
MF instance name, MF remote name/entry, Fronts phase/error code
```

This is enough to decide whether ownership lies with deployment policy, MF resource loading,
producer protocol/rendering, container isolation, or host capability/service code.
