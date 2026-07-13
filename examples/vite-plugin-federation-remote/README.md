# vite-plugin-federation remote

Runs on `http://127.0.0.1:4202`. It uses the unscoped `vite-plugin-federation` producer to expose
`./application` through `mf-manifest.json`. The plain Vite host consumes that manifest with its own
official `@module-federation/runtime` instance; the plugin's bundled runtime is not passed to
`@fronts/mf`.

Open `http://127.0.0.1:4200/?producer=vite-plugin-federation` after starting the examples.
