---
'@fronts/vue3': patch
---

Settle Vue render readiness before invoking the optional error observer so observer failures cannot replace the application failure.
