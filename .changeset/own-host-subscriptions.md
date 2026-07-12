---
'@fronts/core': patch
---

Scope each host event subscription to its own unsubscribe function so stale cleanup cannot remove later subscriptions that reuse a listener.
