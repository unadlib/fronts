---
'@fronts/react': patch
---

Reject application contracts containing React's reserved `key` prop from `component()` while
keeping those contracts available through the inline `App` binding.
