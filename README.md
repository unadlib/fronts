<a href="https://fronts.js.org/" target="_blank"><img src="https://raw.githubusercontent.com/unadlib/fronts/master/logo.svg" height="120" alt="Fronts Logo" /></a>

---

![Node CI](https://github.com/unadlib/fronts/workflows/Node%20CI/badge.svg)
[![npm version](https://badge.fury.io/js/fronts.svg)](http://badge.fury.io/js/fronts)
![license](https://img.shields.io/npm/l/fronts)

`Fronts` is a progressive micro frontends framework for building Web applications, and it's based on the [module federation](https://webpack.js.org/concepts/module-federation/) of Webpack.

## Motivation

Among the many micro frontends solutions, [single-spa](https://github.com/single-spa/single-spa) and [Module Federation](https://webpack.js.org/concepts/module-federation/) are the best of them.

[single-spa](https://github.com/single-spa/single-spa) is a micro frontends framework based on router configuration. The centralization of configuration brings some limitations, such as it is difficult to granulate nestable micro frontends, module granularity control, module sharing, and so on.

In 2019, Zack Jackson proposed and implemented Module Federation. Module Federation is a completely different concept from single-spa, and allows a JavaScript application to dynamically load code from another application. It completely solves the problem of code dependency sharing and runtime modularity. The idea is true - "[A game-changer in JavaScript architecture](https://medium.com/swlh/webpack-5-module-federation-a-game-changer-to-javascript-architecture-bcdd30e02669)" as mentioned in Zack Jackson's article. And it's currently supported by Webpack, Next.js, and Rollup.

Although the Module Federation concept is so amazing, it has not yet gone further to provide a more complete and fully targeted micro frontends framework implementation, and this is what `Fronts` is trying to do.

## Features

- **Non-module-federation** - Although Fronts is based on the concept of module federation, it also supports `non-module-federation` mode.
- **Decentralized configuration** - Configure `site.json` for dependency management in each Fronts app, support for nested micro frontends.
- **Cross frameworks** - No framework or technology stack is restricted.
- **Code splitting & lazy loading** - Support code splitting within the Fronts app as a module, it can be lazy loaded by other Fronts app as a dependent module.
- **CSS isolation** - Optional CSS isolation solution.
- **Lifecycle** - Fronts provide concise lifecycle for Fronts app entry.
- **Web Components & iFrame** - Support for multiple frontend containers.
- **Multiple patterns** - Support for building `micro-frontends` app and `non-micro-frontends` app.
- **Monorepo & TypeScript** - Friendly support for Monorepo and TypeScript, which are mutually appropriate technology stack.
- **Version control** - It's used for efficient and dynamic delivery apps such as canary release.
- **Zero hijacking** - Fronts didn't do any hijacking, maintaining originality and possible loss of performance and security.

## Getting Started

> You can follow this article(["React without create-react-app Webpack 5"](https://dev.to/rogeliosamuel621/react-without-create-react-app-webpack-5-1b1o)) to quickly create `app1` and `app2` React projects.

Assuming you've completed these steps, let's get started with a quick taste of the wonderful micro frontends development of Fronts.

1. Install `fronts-react` and `fronts-bundler` in the projects.

```shell
# with NPM
npm install fronts-react fronts-bundler

# or with Yarn
yarn add fronts-react fronts-bundler
```

2. Set up `site.json` and `webpack.config.js` in the projects

We define `app1` as a parent micro frontend and it depends on `app2`.

`app1/site.json`:

```json
{
  "name": "app1",
  "exports": [],
  "dependencies": {
    "app2": "http://localhost:3002/remoteEntry.js"
  }
}
```

`app2` doesn't have any dependencies, it acts as a micro frontend and we define it to export `./src/bootstrap` as a micro frontends entry, this entry of `app2` end will be used by `app1`.

`app2/site.json`:

```json
{
  "name": "app2",
  "exports": ["./src/bootstrap"],
  "dependencies": {}
}
```

Wrap the Webpack config with `createWebpackConfig()` in `config/webpack.config.js` in the projects.

```js
const { createWebpackConfig } = require('fronts-bundler');

module.exports = createWebpackConfig(originalWebpackConfig);
```

3. Load `app1/src/App.jsx` with `useApp()` to import `app2`.

```jsx
import React from 'react';
import { useApp } from 'fronts-react';

export const App = () => {
  const App2 = useApp({
    name: 'app2',
    loader: () => import('app2/src/bootstrap'),
  });
  return <App2 />;
};
```

4. Define the default exported bootstrap function in `app2/src/bootstrap.jsx` and use `boot()` to get it booted.

```jsx
import React from 'react';
import ReactDOM from 'react-dom';
import { boot } from 'fronts-react';
import App from './App';

export default function render(element) {
  ReactDOM.render(<App />, element);
  return () => {
    ReactDOM.unmountComponentAtNode(element);
  };
}

boot(render, document.getElementById('root'));
```

## APIs

| API                  |      Isolation      |
| :------------------- | :-----------------: |
| `useApp()`           | CSS(loose/optional) |
| `useWebComponents()` |         CSS         |
| `useIframe()`        |   CSS, JavaScript   |

### Built-in packages

The most popular frontend frameworks are React, Vue and Angular. When the micro frontends uses one of these frameworks, it is recommended to use Fronts built-in package for this framework, such as `fronts-react`, `fronts-vue` and `fronts-ng`, otherwise please use `front`.

| Packages       | Support Framework |         Status |
| :------------- | :---------------: | -------------: |
| `fronts`       |   Any Framework   |   Completed ✅ |
| `fronts-react` |       React       |   Completed ✅ |
| `fronts-vue`   |        Vue        | In Progress 💡 |
| `fronts-ng`    |      Angular      |              - |

## Running Type

| Type                  |                 Requirement                 |                                                            Support |
| :-------------------- | :-----------------------------------------: | -----------------------------------------------------------------: |
| Non-Module-Federation |                      -                      | Dependency Management ❌<br/> Monorepo ❌<br/> Version Management ❌ |
| Module Federation     |           Webpack<br />site.json            | Dependency Management ✅<br/> Monorepo ✅<br/> Version Management ❌ |
| Version Control       | Webpack<br />site.json<br />Registry Server | Dependency Management ✅<br/> Monorepo ✅<br/> Version Management ✅ |

## Examples

- [Simple Example](https://github.com/unadlib/fronts-example)

## Debugger/Logger

Use `getMeta()`, it helps you to get the dependency mapping information.

```js
import { getMeta } from 'fronts';

console.log(getMeta());

// {
//   "name": "app3",
//   "meta": {
//       "__main__": "app1",
//       "__entry__": "http://localhost:3001/#/app2",
//       "app2": {
//           "dependencies": {
//               "app3": "http://localhost:3003"
//           }
//       },
//       "app5": {
//           "dependencies": {
//               "app6": "http://localhost:3006"
//           }
//       },
//       "app3": {
//           "dependencies": {}
//       },
//       "app6": {
//           "dependencies": {}
//       },
//       "app1": {
//           "dependencies": {
//               "app2": "http://localhost:3002",
//               "app4": "http://localhost:3004",
//               "app5": "http://localhost:3005"
//           }
//       }
//   }
// }
```

## Testing

`fronts-test` provides an runner for function step, and any micro frontends IT and E2E can use it for reusable testing. It also provides other APIs, such as `useContext()`, beforeHook and afterHook in `createRunner()`.

```ts
import { run, useContext } from 'fronts-test';

const addTodo = (todoText) => {
  const { page } = useContext();
  await page.type('.text', todoText);
  await page.click('.add');
}

const entry = () => {
  await run(addTodo, 'Use Fronts');
}
```

## CLI

todo

## Version Control

Set up the registry server URL in the `registry` field.

```diff
{
  "name": "app1",
  "exports": [],
+ "registry": "http://localhost:3000/dev.json",
  "dependencies": {
-    "app2": "http://localhost:3002/remoteEntry.js"
+    "app2": "1.0.0"
  }
}
```

Start the registry server and make sure that `http://localhost:3000/dev.json?scope=app2%401.0.0` request gets a response data with the version specification.

```json
{
  "app2": "http://localhost:3002/remoteEntry.js"
}
```

## Tutorial

todo

## Q&A

Q: Can Non-Module-Federation, Module Federation, and Version Control be compatible with each other?

A: Yes

Q: How to use SPA development mode in micro frontends codebase?

A: Use `SPA=true yarn start` instead of `yarn start`, make sure the current codebase is Monorepo and Module Federation or Version Control is enabled.


## License

Fronts is MIT licensed.
