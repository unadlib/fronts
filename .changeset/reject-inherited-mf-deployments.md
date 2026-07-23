---
'@fronts/mf': patch
---

Reject inherited static Module Federation deployment fields before snapshotting them so prototype
state cannot become trusted remote, selector, preload, or deployment metadata configuration.
