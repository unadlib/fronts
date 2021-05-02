# fronts

A progressive micro frontends framework for building Web applications.

## Features

- Support Non-module-federation
- Cross Framework
- Code Splitting
- Lazy Loading
- Lifecycle
- Decentralized Configuration
- Quickly Switch Between SPA & Micro Frontends
- Support Monorepo & TypeScript
- Version Control System
- Canary Release

### Mode

- Inline

> It must be consistent with the framework used by its dependent micro frontends.

For example,

```tsx
import { TodoList } from 'App1/src/List';

const App = () => {
  <>
    <TodoList />
  </>;
};
```

> In this example, the `App` depends on the components of `App1`, and they are all based on React

- Standalone

> It and its dependent micro frontends can be cross-framework.

```tsx
import { useApp } from 'fronts-react';

const App = () => {
  const App1WithVue = useApp(() => import('app1/src/main'));
  return (
    <>
      <App1WithVue />
    </>
  );
};
```

- iframe

```tsx
import { useIFrame } from 'fronts-react';

const App = () => {
  const App1 = useIFrame('app1');
  return (
    <>
      <App1 />
    </>
  );
};
```

- WebComponents

```tsx
import { useWebComponents } from 'fronts-react';

const App = () => {
  const App1 = useWebComponents(() => import('app1/src/main'));
  return (
    <>
      <App1 />
    </>
  );
};
```

## Running Type

| Type                  |         description          |                                APIs |
| :-------------------- | :--------------------------: | ----------------------------------: |
| non-module-federation |        No `site.json`        |            useApp, useWebComponents |
| module-federation     |         `site.json`          |  useApp, useWebComponents,useIFrame |
| version control       | `site.json`, registry server | useApp, useWebComponents, useIFrame |

## Debugger/Logger

## Testing

## CLI
