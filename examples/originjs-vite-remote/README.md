# OriginJS Vite federation remote

Runs on `http://127.0.0.1:4203`. It uses `@originjs/vite-plugin-federation` only as a production ESM
producer. The example's `dev` command deliberately builds and previews the remote because OriginJS
does not support a bundleless Vite dev remote.

This legacy compatibility fixture stays on Vite 5.4. OriginJS 1.4.1's output transformation is not
compatible with the Vite 8/Rolldown pipeline used by the other Vite examples.

The remote shares `@fronts/core` with its generated fallback enabled. The plain Vite host loads
`assets/remoteEntry.js` through its official `@module-federation/runtime` instance, proving the
container/share-scope compatibility path without adopting OriginJS's virtual Host API.

Open `http://127.0.0.1:4200/?producer=originjs` after starting the examples.
