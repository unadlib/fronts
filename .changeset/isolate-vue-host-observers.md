---
'@fronts/vue3': patch
---

Isolate Vue remote host readiness and error observers so their exceptions cannot create unhandled promise rejections or alter remote state.
