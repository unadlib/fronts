# Core-only host

Runs on `http://127.0.0.1:4110`. This example uses only `@fronts/core`: a custom loader imports a
local application module and the host owns resolution, lifecycle, DOM containment, scoped services,
and cleanup. Module Federation and framework adapters are intentionally absent.
