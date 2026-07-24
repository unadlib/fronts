---
'@fronts/core': minor
---

Add `createModuleHost()`, a `@fronts/core` composition shortcut for applications the caller can already import. An `apps` map of module loaders synthesizes the static resolver and application loader that previously had to be written by hand, so a shell that needs no runtime deployment policy reaches a typed `HostComposition` without a transport package. Props contracts are inferred from each application's own `defineApp` declaration, and every Host behaviour below the composition root is unchanged.
