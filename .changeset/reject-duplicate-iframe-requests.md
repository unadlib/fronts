---
'@fronts/core': patch
---

Ignore duplicate in-flight iframe RPC request identifiers so they cannot replace cancellation state or dispatch twice.
