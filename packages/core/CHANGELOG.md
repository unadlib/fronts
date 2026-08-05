# @fronts/core

## 1.0.0-next.1

### Major Changes

- bbc0db0: Align the application and iframe protocol versions with the 1.0 release line. `FRONTS_APP_PROTOCOL_VERSION` and `FRONTS_IFRAME_PROTOCOL_VERSION` are now `1`, and the branded application symbols move from `@fronts/core/application/v2` to `@fronts/core/application/v1`. A producer built against the previous prerelease constants no longer validates, which is intentional while nothing is published.

### Minor Changes

- 34e4af4: Add `createModuleHost()`, a `@fronts/core` composition shortcut for applications the caller can already import. An `apps` map of module loaders synthesizes the static resolver and application loader that previously had to be written by hand, so a shell that needs no runtime deployment policy reaches a typed `HostComposition` without a transport package. Props contracts are inferred from each application's own `defineApp` declaration, and every Host behaviour below the composition root is unchanged.
- a86ac52: Add transport-neutral `HostComposition`, application contract, name, and catalog types so delivery and framework packages can share typed application references without depending on one another.
- ca7759c: Add context-aware per-instance service providers with revocation and deterministic async disposal.
- 4f43a43: Add asynchronous resolution-aware container planning, pass resolved deployments into container preparation, and expose planners through the React and Vue host adapters.
- 7e0a9d0: Expose cleanup failures in instance snapshots and host audits, and reject host disposal when
  runtime resources could not be released completely.
- 71aef2b: Require one-time iframe capability negotiation and enforce the resulting grant on every RPC call.
- 41a8824: Add correlated host operation contexts to resolver, loader, and container extension boundaries.

### Patch Changes

- 5bfead3: Advance Host transactions to the mount phase before invoking applications so cancellation and observability are attributed correctly.
- 4d2b4ed: Attribute typed nested failures to the active Host lifecycle phase while retaining their original code, details, and cause.
- d57ad09: Retain ownership metadata for containers acquired after cancellation so disposal contract
  violations remain visible to host audits.
- 2e5bf6c: Make iframe agent shutdown await cleanup for application handles that arrive after mount cancellation.
- 3f45456: Make asynchronous capability authorization abort-aware and expose the instance signal to policies.
- 5473a3e: Cancel pending iframe update, activate, and deactivate RPC calls when the application lifetime ends.
- 967f4cd: Track and clean container and application handles that resolve after a mount is cancelled.
- 557c426: Stop iframe agent sessions when an application failure notification cannot be delivered.
- 77e0584: Unmount iframe application handles that expose cleanup but fail the remaining runtime contract validation.
- 1b4dd0c: Stop awaiting cancelled service providers and dispose any provider result that arrives later.
- 0863e99: Close iframe RPC peers when a fire-and-forget request response cannot be delivered.
- 47c8fbe: Release replacement transaction markers and clean partial staging slots when slot creation fails.
- 9518c24: Delay linking caller abort signals until mount identifiers and transaction inputs have been
  validated.
- 8c8a5f0: Snapshot and freeze iframe agent identity, resolution, operation, and mount context envelopes.
- 9dd868a: Snapshot and freeze host-issued references, operations, identities, resolution policy, and resolved
  deployment envelopes before exposing them to runtime extensions.
- 151a55b: Freeze service provider and capability policy context envelopes before invoking host extensions.
- 45fa1e8: Reject generic iframe attributes that could override Fronts security options, protocol state, or
  inline event handlers.
- 0a40430: Honor resolver cancellation after every asynchronous policy, cache, fallback, and registry boundary.
- 810ab20: Route custom container types through explicitly configured own loader properties instead of inherited object prototype members.
- a1719ea: Ignore unrelated window messaging protocols without closing their transferred MessagePorts.
- 56e663d: Snapshot container requests into null-prototype envelopes so data fields cannot alter adapter inheritance.
- 0a1280c: Isolate iframe RPC notification listeners so one observer cannot block later listeners or escape the MessagePort event loop.
- f54fc50: Keep host lifecycle and cleanup operations running when a custom observability clock throws or returns a non-finite timestamp.
- 7a1372e: Keep `HostComposition` contracts invariant so compositions with the same application names but different props cannot be rebound accidentally.
- 548cf1a: Treat configured iframe capabilities as an optional negotiation maximum while preserving strict
  capability requirements for ordinary applications and the real child application.
- 6c5e3c7: Report malformed iframe agent origin allowlists as stable iframe protocol errors.
- 7f204e4: Notify the remote iframe RPC peer before closing a MessagePort so pending requests reject immediately and both peers release their state.
- d43bcbf: Scope each host event subscription to its own unsubscribe function so stale cleanup cannot remove later subscriptions that reuse a listener.
- adf592a: Scope iframe RPC disposer functions to the handler or listener registration that created them so stale cleanup cannot remove later registrations.
- 0529090: Attach the requested operation phase to errors returned by disposed Hosts so callers and telemetry can route them consistently.
- c9af4a9: Preserve resolved source types through container registries and inline host container adapters.
- d0206e1: Preserve typed capability and iframe validation errors for values that cannot be stringified.
- 990f568: Preserve service provider validation errors while reporting failures from rolling back an invalid
  provider result as incomplete host cleanup.
- 0bc2d86: Insert registry resolution query parameters before URL fragments so they reach the server.
- 9480045: Ignore duplicate in-flight iframe RPC request identifiers so they cannot replace cancellation state or dispatch twice.
- bd311c9: Require remote application modules to provide their default application as an own export.
- b4e6d2b: Reject inherited application reference fields so prototype state cannot alter resolution requests.
- e6c3714: Reject container requests whose routing type would be lost while snapshotting inherited fields.
- 0512b4d: Only honor the internal iframe capability-negotiation marker when it belongs to the proxy app.
- cb69b18: Reject inherited resolution contract fields that would be lost from the host deployment snapshot.
- f52d803: Report malformed or duplicate iframe connections without throwing from the window message handler
  or retaining transferred message ports.
- 692c802: Release terminal application records after complete cleanup so instance identities can be reused.
- 1decb73: Report iframe application cleanup failures from agent stop after closing every session resource.
- 8793366: Emit host error events when an application does not implement a requested update lifecycle.
- cccaf3e: Reject optional logical application entries in composition contracts so bound application props
  cannot widen to `undefined`.
- c9a01a4: Require iframe agents to preserve a dedicated cross-origin identity so exact-origin connection messages are deliverable without a wildcard target.
- 4beea4e: Keep terminal application records auditable until every abandoned acquisition cleanup settles.
- 257c869: Remove a partially appended iframe agent root when the target reports an insertion failure.
- 042d9a3: Close both iframe proxy message ports when RPC peer construction fails.
- 64bea9d: Remove built-in container elements when a target append fails after partially inserting them.
- be5b2f5: Roll back a ready replacement if committing its staging container fails before the previous application is unmounted.
- e84965d: Serialize arbitrary iframe errors safely even when values cannot be stringified or expose throwing property getters.
- 7ed97dd: Settle local iframe RPC requests even when their best-effort cancellation frame cannot be sent.
- 4848ac5: Abort iframe proxy readiness when the handle is unmounted before frame loading or agent handshake completes.
- 0471327: Make concurrent iframe agent stop calls await the same in-progress session cleanup.
- 59fa995: Share one application cleanup operation between iframe lifecycle unmount requests and agent shutdown, including mounts that finish after cancellation.
- 956846f: Snapshot mount props, target, timeout, resolution policy, and container configuration before
  asynchronous resolution begins.
- 63d1e11: Publish the first complete Fronts 1.0 application runtime alpha, including the framework-neutral
  protocol and host, Module Federation 2 adapter, React and Vue 3 adapters, isolation containers,
  production replacement controls, observability, and examples.
- e9c9653: Track and abort direct resolve, load, and preload operations as part of host disposal and audit.
- 1069504: Reject application handles whose optional lifecycle members are not functions.
- 5d7e2eb: Reject malformed application reference objects and non-string fields with stable resolution
  errors.
- e5b5300: Reject malformed container adapters when they are registered instead of deferring configuration errors until mount.
- 4f80586: Validate container requests before starting a host mount transaction and map unreadable request objects to container failures.
- 081c57d: Normalize iframe agent host identifiers and reject empty or non-string runtime values.
- eb7c17b: Reject invalid iframe RPC methods, callbacks, channels, and registrations made after a peer is closed.
- c72d6f2: Validate iframe RPC request, response, notification, cancellation, and serialized error fields before dispatch.
- d0b73fa: Validate iframe session identities and require their name, expose, and version to match the resolved application before loading it.
- dce968e: Validate custom prepared container results and roll back invalid results before handing them to the
  host lifecycle.
- 8a0683a: Validate host and per-mount readiness timeouts before resolving, loading, or mounting an
  application.
- 7960821: Validate resolution policy strings and metadata objects before invoking deployment resolvers.
- 777af43: Reject resolution decisions with mismatched references, invalid versions, or non-record metadata.
- 3cc7643: Validate explicit and generated runtime identifiers and report invalid detached operation IDs in
  their matching resolve or load phase.
- 0ab9455: Require branded applications to pass the same protocol name and version checks as structural
  remote applications.
- d85a231: Wait for complete replacement transaction rollback and staging cleanup before host disposal audits
  the runtime as idle.
