# Plain Vite runtime host

Runs on `http://127.0.0.1:4200`. Vite only builds and serves the shell. The host intentionally does
not install `@module-federation/vite`; it creates an explicit `@module-federation/runtime` instance
and passes that instance to `@fronts/mf`.

The default route loads the application exposed by `@fronts-example/vite-remote`. Open
`/?producer=vite-plugin-federation` to load the manifest emitted by
`@fronts-example/vite-plugin-federation-remote` through the same official runtime instance.

Open `/?producer=originjs` to load the production ESM `remoteEntry.js` emitted by
`@fronts-example/originjs-vite-remote`. OriginJS is used only as the producer; its virtual Host API
is intentionally not part of this shell.
