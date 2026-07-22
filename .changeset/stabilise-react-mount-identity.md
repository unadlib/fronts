---
'@fronts/react': patch
---

Compare the container request and resolution policy by value in `useRemoteApp` so an inline object literal re-created by an ordinary render no longer unmounts and remounts the application. Container request resolvers and other functions still compare by reference.
