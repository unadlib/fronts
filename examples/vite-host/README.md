# Plain Vite runtime host

Runs on `http://127.0.0.1:4200`. Vite only builds and serves the shell. The host intentionally does
not install `@module-federation/vite`; it creates an explicit `@module-federation/runtime` instance
and passes that instance to `@fronts/mf`.

The host loads the application exposed by `@fronts-example/vite-remote`.
