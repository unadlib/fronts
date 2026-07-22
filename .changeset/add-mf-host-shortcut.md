---
'@fronts/mf': minor
---

Add `createMfHost()` as a typed composition shortcut over the official Module Federation runtime, static or caller-supplied resolution, the existing MF adapter, and `createFrontsHost()`. Its result carries the application reference catalog required by framework bindings, including non-default exposes.
