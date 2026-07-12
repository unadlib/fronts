---
'@fronts/react': patch
---

Reset the application error boundary after a failed render so a later update can recover without
blocking lifecycle teardown.
