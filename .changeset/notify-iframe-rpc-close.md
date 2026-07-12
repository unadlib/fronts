---
'@fronts/core': patch
---

Notify the remote iframe RPC peer before closing a MessagePort so pending requests reject immediately and both peers release their state.
