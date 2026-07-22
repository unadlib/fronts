---
'@fronts/vue3': patch
---

Return `retry()` from the Vue `useRemoteApp()` composable and pass `{ error, retry }` to the `RemoteApp` `error` slot and `fallback` prop so a host can recover from a failed resolve, load, or mount without recreating its own component tree. Both now receive a failure object rather than a bare `Error`.
