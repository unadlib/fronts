---
'@fronts/vue3': patch
---

Type the Vue `RemoteApp` `container` prop against the built-in container requests so `tagName`, `className`, `attributes`, `mode`, and `delegatesFocus` are accepted. The prop previously resolved to the bare `ContainerRequest` base, whose only member is `type`, so excess property checking rejected every documented DOM and Shadow DOM request.
