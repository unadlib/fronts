# phare

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
    "name": "header",
    "version": "0.2.3",
    "main": "index.js",
    "deps": {
        "body": "https://example.com/v0.2.3/body",
        "footer": "^0.3.4",
    },
    "registry": "https://examplehub.com/",
}
```

> mode: Inline, Sandbox, Standalone, iFrame, WebComponents

> WebWorker, WebAssembly, SharedWorker

# TODO
