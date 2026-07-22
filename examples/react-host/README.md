# React orchestration host

Runs on `http://127.0.0.1:4100`. Start all four processes from the repository
root with `pnpm dev:examples`.

The shell uses `createMfHost()` and `createReactBindings()` to mount React, Vue 3, and isolated
iframe applications from one typed Host composition. Only the remotes and iframe agent own
framework rendering.
