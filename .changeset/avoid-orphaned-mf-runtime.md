---
'@fronts/mf': patch
---

Validate Fronts Host configuration before creating an owned Module Federation runtime so a rejected
composition cannot leave an unreachable instance in the official runtime registry.
