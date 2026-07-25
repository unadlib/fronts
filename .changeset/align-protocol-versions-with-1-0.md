---
'@fronts/core': major
---

Align the application and iframe protocol versions with the 1.0 release line. `FRONTS_APP_PROTOCOL_VERSION` and `FRONTS_IFRAME_PROTOCOL_VERSION` are now `1`, and the branded application symbols move from `@fronts/core/application/v2` to `@fronts/core/application/v1`. A producer built against the previous prerelease constants no longer validates, which is intentional while nothing is published.
