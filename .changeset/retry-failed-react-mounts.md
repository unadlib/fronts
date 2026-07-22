---
'@fronts/react': minor
---

Return `retry()` from `useRemoteApp()` and pass `{ error, retry }` to the `RemoteApp` fallback so a host can recover from a failed resolve, load, or mount without remounting its own React tree. The fallback now receives a failure object rather than a bare `Error`.
