---
'@fronts/core': patch
---

Scope iframe RPC disposer functions to the handler or listener registration that created them so stale cleanup cannot remove later registrations.
