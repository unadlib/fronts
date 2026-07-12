---
'@fronts/core': patch
---

Isolate iframe RPC notification listeners so one observer cannot block later listeners or escape the MessagePort event loop.
