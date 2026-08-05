# @fronts/react

## 1.0.0-next.1

### Minor Changes

- b884055: Add `createReactBindings()` for rendering any typed Host composition through an inline `App`, stable application component factories, and typed preloading. Bindings infer application contracts and reference defaults from `createMfHost()` results while remaining transport-neutral.
- 4f43a43: Add asynchronous resolution-aware container planning, pass resolved deployments into container preparation, and expose planners through the React and Vue host adapters.
- 3c14237: Return `retry()` from `useRemoteApp()` and pass `{ error, retry }` to the `RemoteApp` fallback so a host can recover from a failed resolve, load, or mount without remounting its own React tree. The fallback now receives a failure object rather than a bare `Error`.

### Patch Changes

- 23f739f: Compare opaque mount input values such as dates, DOM nodes, and class instances by identity while retaining structural equality for plain records and arrays. This prevents distinct custom container inputs from being treated as the same request.
- dc01883: Compare React application props by value so a re-render that repeats the same values no longer calls `update()`, and accept `arePropsEqual` for callers that need a different equality contract. This matches the value-based comparison the Vue adapter already performed.
- de6c8dd: Document the additional `@fronts/mf` and official runtime dependencies required by the typed Module
  Federation Host examples.
- 9e23335: Isolate React remote host readiness and error observers so their exceptions cannot create unhandled promise rejections or alter remote state.
- 81522fa: Normalize arbitrary Host rejection values without letting unstringifiable values break remote application error state.
- af33848: Keep React render failures authoritative and the error boundary stable when the optional error observer throws.
- 91dac06: Project only the documented application and resolution selection fields so untyped render and
  preload inputs cannot replace catalog names or exposes or inject detached Host operation controls.
- 9ff49d6: Reset the application error boundary after a failed render so a later update can recover without
  blocking lifecycle teardown.
- 213e544: Exclude contracts containing framework-reserved props from stable component factories so React or
  Vue cannot silently consume fields before they reach the remote application. Inline `App` bindings
  continue to support those contracts through their nested `props` object.
- 8f83b1d: Reset remote hooks to idle when their target disappears so exposed state matches teardown and later targets remount cleanly.
- 16c118b: Respect null custom render results instead of falling back to the default React root component.
- 42391b5: Roll back React roots when initial render composition fails before an application handle can be
  returned.
- d493bd6: Wait for the previous remote application teardown before mounting a replacement from the React
  host hook.
- dc8fb6a: Compare the container request and resolution policy by value in `useRemoteApp` so an inline object literal re-created by an ordinary render no longer unmounts and remounts the application. Container request resolvers and other functions still compare by reference.
- 63d1e11: Publish the first complete Fronts 1.0 application runtime alpha, including the framework-neutral
  protocol and host, Module Federation 2 adapter, React and Vue 3 adapters, isolation containers,
  production replacement controls, observability, and examples.
- Updated dependencies [34e4af4]
- Updated dependencies [a86ac52]
- Updated dependencies [5bfead3]
- Updated dependencies [bbc0db0]
- Updated dependencies [4d2b4ed]
- Updated dependencies [d57ad09]
- Updated dependencies [2e5bf6c]
- Updated dependencies [ca7759c]
- Updated dependencies [3f45456]
- Updated dependencies [5473a3e]
- Updated dependencies [967f4cd]
- Updated dependencies [557c426]
- Updated dependencies [77e0584]
- Updated dependencies [1b4dd0c]
- Updated dependencies [0863e99]
- Updated dependencies [47c8fbe]
- Updated dependencies [9518c24]
- Updated dependencies [8c8a5f0]
- Updated dependencies [9dd868a]
- Updated dependencies [151a55b]
- Updated dependencies [45fa1e8]
- Updated dependencies [0a40430]
- Updated dependencies [810ab20]
- Updated dependencies [a1719ea]
- Updated dependencies [56e663d]
- Updated dependencies [0a1280c]
- Updated dependencies [f54fc50]
- Updated dependencies [7a1372e]
- Updated dependencies [548cf1a]
- Updated dependencies [6c5e3c7]
- Updated dependencies [7f204e4]
- Updated dependencies [d43bcbf]
- Updated dependencies [adf592a]
- Updated dependencies [0529090]
- Updated dependencies [4f43a43]
- Updated dependencies [c9af4a9]
- Updated dependencies [d0206e1]
- Updated dependencies [990f568]
- Updated dependencies [0bc2d86]
- Updated dependencies [9480045]
- Updated dependencies [bd311c9]
- Updated dependencies [b4e6d2b]
- Updated dependencies [e6c3714]
- Updated dependencies [0512b4d]
- Updated dependencies [cb69b18]
- Updated dependencies [f52d803]
- Updated dependencies [692c802]
- Updated dependencies [7e0a9d0]
- Updated dependencies [1decb73]
- Updated dependencies [8793366]
- Updated dependencies [cccaf3e]
- Updated dependencies [c9a01a4]
- Updated dependencies [4beea4e]
- Updated dependencies [257c869]
- Updated dependencies [042d9a3]
- Updated dependencies [64bea9d]
- Updated dependencies [be5b2f5]
- Updated dependencies [71aef2b]
- Updated dependencies [e84965d]
- Updated dependencies [7ed97dd]
- Updated dependencies [4848ac5]
- Updated dependencies [0471327]
- Updated dependencies [59fa995]
- Updated dependencies [956846f]
- Updated dependencies [63d1e11]
- Updated dependencies [41a8824]
- Updated dependencies [e9c9653]
- Updated dependencies [1069504]
- Updated dependencies [5d7e2eb]
- Updated dependencies [e5b5300]
- Updated dependencies [4f80586]
- Updated dependencies [081c57d]
- Updated dependencies [eb7c17b]
- Updated dependencies [c72d6f2]
- Updated dependencies [d0b73fa]
- Updated dependencies [dce968e]
- Updated dependencies [8a0683a]
- Updated dependencies [7960821]
- Updated dependencies [777af43]
- Updated dependencies [3cc7643]
- Updated dependencies [0ab9455]
- Updated dependencies [d85a231]
  - @fronts/core@1.0.0-next.1
