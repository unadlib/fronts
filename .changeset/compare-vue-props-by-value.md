---
'@fronts/vue3': patch
---

Compare re-created Vue application prop objects by value so a parent re-render that repeats the same values no longer calls `update()`, and accept `arePropsEqual` for callers that need a different equality contract. In-place mutation of a reactive prop object still updates the application.
