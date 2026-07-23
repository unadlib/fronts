---
'@fronts/react': patch
'@fronts/vue3': patch
---

Exclude contracts containing framework-reserved props from stable component factories so React or
Vue cannot silently consume fields before they reach the remote application. Inline `App` bindings
continue to support those contracts through their nested `props` object.
