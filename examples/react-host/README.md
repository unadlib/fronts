# React orchestration host

Runs on `http://127.0.0.1:4100`. Start all five processes from the repository
root with `pnpm dev:examples`.

The shell mounts React, Vue 3, isolated iframe and Fronts 0.x applications from
one host runtime. Only the remotes and iframe agent own framework rendering.
