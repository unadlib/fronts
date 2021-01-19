# fronts

A Progressive  Micro Integration Infrastructure Framework

- [x] Reuse of public libraries in every micro-frontends
- [ ] Scripts cache management / Incremental updates
- [ ] Handling exceptions to switch main routes
- [ ] Scripts pre-processing at runtime
- [ ] Dynamic global configuration
- [ ] Runtime isolation modes
- [x] Cross-domain policy management
- [ ] Version control
- [ ] Version management system
- [ ] Canary release
- [ ] Redefining the life cycle of micro-frontend
- [ ] Error handling
- [ ] Logger with micro-frontends configs & versions
- [ ] nested micro-frontends
- [ ] Standalone development mode with a micro-frontend
- [ ] Global Event system
- [ ] Handling data consistency
- [ ] Building tools cli
- [ ] Webpack handling version control for same lib

site.json

```json
{
    "name": "app",
    "version": "0.2.3",
    "main": "index.js",
    "dependencies": {
        "header": "^0.2.3",
        "footer": "^0.3.4",
    },
    "registry": "https://examplehub.com/",
}
```

> mode: Inline, Standalone, iFrame, WebComponents

> runner: Sandbox, WebWorker, WebAssembly, SharedWorker

# TODO

- [x] `const App = useApp(() => import('app3'));`
- `const IFrame = useIFrame('app3');`
- Dynamic configuration
- `const url = getIFrame('app3')`
- `WebComponents`
- `version`
- `Sandbox`
