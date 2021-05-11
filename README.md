# Fronts

![Node CI](https://github.com/unadlib/fronts/workflows/Node%20CI/badge.svg)
[![npm version](https://badge.fury.io/js/fronts.svg)](http://badge.fury.io/js/fronts)
![license](https://img.shields.io/npm/l/fronts)

`Fronts` is a progressive micro frontends framework for building Web applications, and it's based on the [module federation](https://webpack.js.org/concepts/module-federation/) of Webpack.

## Motivation

todo

## Concepts

todo

## Features

- **Non-module-federation** - Although Fronts is based on the concept of module federation, it also supports `non-module-federation` mode.
- **Decentralized configuration** - Dependency management is done by configuring `site.json` for each Fronts app, support for nested micro frontends.
- **Cross framework** - No framework or technology stack is restricted.
- **Code splitting & lazy loading** - Support code splitting within the Fronts app as a module, it can be lazy loaded by other Fronts app as a dependent module.
- **CSS isolation** - Optional CSS isolation solution.
- **Lifecycle** - Fronts provide concise lifecycle for Fronts app entry.
- **Web Components & iFrame** - Support for multiple frontend runtime containers.
- **Multiple patterns** - It supports simple switching between build mode `micro-frontends` and `non-micro-frontends`.
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

We define `app1` as a parent micro frontend and it depends on the `app2` micro frontend.

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

`app2` doesn't have any dependencies, it acts as a micro frontend and we define it to export `./src/index`, this entry of `app2` end will be used by `app1`.

`app2/site.json`:

```json
{
  "name": "app2",
  "exports": ["./src/index"],
  "dependencies": {}
}
```

Wrap the Webpack config with `createWebpackConfig()` in `config/webpack.config.js` in the projects.

```js
const { createWebpackConfig } = require('fronts-bundler');

module.exports = module.exports = function (webpackEnv) {
  // ...template webpack config code from `create-react-app`
  return createWebpackConfig(originalWebpackConfig);
};
```

3. Use `useApp()` in `app1/src/App.js` to import `app2` micro frontend.

```jsx
import React from 'react';
import { useApp } from 'fronts-react';

export const App = () => {
  const App2 = useApp({
    name: 'app2',
    loader: () => import('app2/src/index'),
  });
  return <App2 />;
};
```

4. Define the default exported bootstrap function in `app2/src/index.js` and use `boot()` to get it booted.

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

| API                |      Isolation      | Description |
| :----------------- | :-----------------: | ----------: |
| `useApp`           | CSS(loose/optional) |             |
| `useWebComponents` |         CSS         |             |
| `useIframe`        |   CSS, JavaScript   |             |

### Built-in packages

| Packages       | Support Framework |         status |
| :------------- | :---------------: | -------------: |
| `fronts`       |   Any Framework   |   Completed ✅ |
| `fronts-react` |       React       |   Completed ✅ |
| `fronts-vue`   |        Vue        | In Progress 💡 |
| `fronts-ng`    |      Angular      |              - |

## Running Type

| Type                  |                 Requirement                 | Description |
| :-------------------- | :-----------------------------------------: | ----------: |
| Non-Module-Federation |                      -                      |             |
| Module Federation     |           Webpack<br />site.json            |             |
| Version Control       | Webpack<br />site.json<br />Registry Server |             |

## Examples

- [Simple Example](https://github.com/unadlib/fronts-example)

## Debugger/Logger

todo

## Testing

todo

## CLI

todo

## Version Control

todo

## Tutorial

todo

## License

Fronts is MIT licensed.
