---
'@fronts/mf': minor
---

Let `createMfHost()` address a remote by version. `RemoteDeployment` is now a union requiring exactly one of `entry` or the new `remoteVersion`, mirroring the official `Remote` type that the low-level `createModuleFederationSource()` already accepted. Version-addressed deployments previously required dropping out of the `apps` shortcut into a hand-written resolver. `remoteVersion` is the selector the official runtime resolves; the existing `version` field remains Fronts deployment identity for audit and conflict detection. A deployment declaring neither address or both is rejected when the composition is created.
