---
'@fronts/react': patch
---

Isolate React remote host readiness and error observers so their exceptions cannot create unhandled promise rejections or alter remote state.
