# @fronts/mf

## 1.0.0-next.1

### Minor Changes

- 8592f8c: Allow static `createMfHost()` deployments to carry resolved metadata for container resolvers, policy, and observability.
- 5336ec7: Add `createMfHost()` as a typed composition shortcut over the official Module Federation runtime, static or caller-supplied resolution, the existing MF adapter, and `createFrontsHost()`. Its result carries the application reference catalog required by framework bindings, including non-default exposes.
- 6ff1869: Let `createMfHost()` address a remote by version. `RemoteDeployment` is now a union requiring exactly one of `entry` or the new `remoteVersion`, mirroring the official `Remote` type that the low-level `createModuleFederationSource()` already accepted. Version-addressed deployments previously required dropping out of the `apps` shortcut into a hand-written resolver. `remoteVersion` is the selector the official runtime resolves; the existing `version` field remains Fronts deployment identity for audit and conflict detection. A deployment declaring neither address or both is rejected when the composition is created.

### Patch Changes

- c0ae5e2: Validate Fronts Host configuration before creating an owned Module Federation runtime so a rejected
  composition cannot leave an unreachable instance in the official runtime registry.
- 73e7fe4: Validate requests before Module Federation registration, map registration errors, and stop before
  load or preload when registration cancels the operation.
- e9613bb: Snapshot Module Federation sources and pass mutable remote copies to the official runtime so its
  normalization cannot rewrite resolved deployment data.
- be35793: Reject ambiguous Module Federation remote definitions that provide both entry and version instead of exactly one deployment locator.
- 7d28fab: Reject inherited static Module Federation deployment fields before snapshotting them so prototype
  state cannot become trusted remote, selector, preload, or deployment metadata configuration.
- 56f9f51: Require the Module Federation remote definition itself to be an own source property.
- b120369: Reject inherited Module Federation source fields that would be dropped before runtime registration.
- 79018e3: Reject reuse of a Module Federation remote name for a different source or resolved version on the same runtime instance unless force replacement is explicit.
- 63d1e11: Publish the first complete Fronts 1.0 application runtime alpha, including the framework-neutral
  protocol and host, Module Federation 2 adapter, React and Vue 3 adapters, isolation containers,
  production replacement controls, observability, and examples.
- 41a8824: Add correlated host operation contexts to resolver, loader, and container extension boundaries.
- 67a1159: Validate Module Federation exposes before remote registration in preload operations, matching load behavior.
- 64aecb0: Reject malformed Module Federation remote and adapter fields before they reach official runtime
  branching and preload logic.
- c14eb59: Validate and snapshot static deployment names, versions, metadata, and match selectors when the
  Module Federation Host is created instead of deferring malformed configuration to first resolve.
- Updated dependencies [34e4af4]
- Updated dependencies [a86ac52]
- Updated dependencies [5bfead3]
- Updated dependencies [bbc0db0]
- Updated dependencies [4d2b4ed]
- Updated dependencies [d57ad09]
- Updated dependencies [2e5bf6c]
- Updated dependencies [ca7759c]
- Updated dependencies [3f45456]
- Updated dependencies [5473a3e]
- Updated dependencies [967f4cd]
- Updated dependencies [557c426]
- Updated dependencies [77e0584]
- Updated dependencies [1b4dd0c]
- Updated dependencies [0863e99]
- Updated dependencies [47c8fbe]
- Updated dependencies [9518c24]
- Updated dependencies [8c8a5f0]
- Updated dependencies [9dd868a]
- Updated dependencies [151a55b]
- Updated dependencies [45fa1e8]
- Updated dependencies [0a40430]
- Updated dependencies [810ab20]
- Updated dependencies [a1719ea]
- Updated dependencies [56e663d]
- Updated dependencies [0a1280c]
- Updated dependencies [f54fc50]
- Updated dependencies [7a1372e]
- Updated dependencies [548cf1a]
- Updated dependencies [6c5e3c7]
- Updated dependencies [7f204e4]
- Updated dependencies [d43bcbf]
- Updated dependencies [adf592a]
- Updated dependencies [0529090]
- Updated dependencies [4f43a43]
- Updated dependencies [c9af4a9]
- Updated dependencies [d0206e1]
- Updated dependencies [990f568]
- Updated dependencies [0bc2d86]
- Updated dependencies [9480045]
- Updated dependencies [bd311c9]
- Updated dependencies [b4e6d2b]
- Updated dependencies [e6c3714]
- Updated dependencies [0512b4d]
- Updated dependencies [cb69b18]
- Updated dependencies [f52d803]
- Updated dependencies [692c802]
- Updated dependencies [7e0a9d0]
- Updated dependencies [1decb73]
- Updated dependencies [8793366]
- Updated dependencies [cccaf3e]
- Updated dependencies [c9a01a4]
- Updated dependencies [4beea4e]
- Updated dependencies [257c869]
- Updated dependencies [042d9a3]
- Updated dependencies [64bea9d]
- Updated dependencies [be5b2f5]
- Updated dependencies [71aef2b]
- Updated dependencies [e84965d]
- Updated dependencies [7ed97dd]
- Updated dependencies [4848ac5]
- Updated dependencies [0471327]
- Updated dependencies [59fa995]
- Updated dependencies [956846f]
- Updated dependencies [63d1e11]
- Updated dependencies [41a8824]
- Updated dependencies [e9c9653]
- Updated dependencies [1069504]
- Updated dependencies [5d7e2eb]
- Updated dependencies [e5b5300]
- Updated dependencies [4f80586]
- Updated dependencies [081c57d]
- Updated dependencies [eb7c17b]
- Updated dependencies [c72d6f2]
- Updated dependencies [d0b73fa]
- Updated dependencies [dce968e]
- Updated dependencies [8a0683a]
- Updated dependencies [7960821]
- Updated dependencies [777af43]
- Updated dependencies [3cc7643]
- Updated dependencies [0ab9455]
- Updated dependencies [d85a231]
  - @fronts/core@1.0.0-next.1
