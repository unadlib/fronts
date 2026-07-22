---
'@fronts/react': patch
---

Compare React application props by value so a re-render that repeats the same values no longer calls `update()`, and accept `arePropsEqual` for callers that need a different equality contract. This matches the value-based comparison the Vue adapter already performed.
