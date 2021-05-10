# Fronts

`Fronts` is a progressive micro frontends framework for building Web applications, and it's based on the module federation of Webpack.

## Motivation

## Concepts

## Features

- **Non-module-federation** - Although Fronts is based on the concept of module federation, it also supports `non-module-federation` mode.
- **Decentralized configuration** - Dependency management is done by configuring `site.json` for each Fronts app, support for nested micro frontends.
- **Cross framework** - No framework or technology stack is restricted.
- **Code splitting & lazy loading** - Support code splitting within the Fronts app as a module, it can be lazy loaded by other Fronts app as a dependent module.
- **CSS isolation** - Optional CSS isolation solution.
- **Lifecycle** - Fronts provide concise lifecycle for Fronts app entry.
- **Web Components & iFrame** - Support for multiple frontend runtime containers.
- **Multiple patterns** - Simple switching between `micro frontends` mode and `non-micro-frontends` mode.
- **Monorepo & TypeScript** - Friendly support for Monorepo and TypeScript, which are mutually appropriate technology stack.
- **Version control** - It is used for efficient and dynamic delivery applications such as canary release.
- **Zero hijacking** - Fronts did not do any hijacking, maintaining originality and possible loss of performance and security.

## Getting Started

> Use `npx create-react-app app1` and `npx create-react-app app2` to quickly create `app1` and `app2` React projects and run `npm run eject` or `yarn run eject` to get `webpack.config.js`, and upgrade `Webpack` to version `5.0+`.

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
| `fronts-ng`    |        Vue        |              - |

## Running Type

| Type                  |                 Requirement                 | Description |
| :-------------------- | :-----------------------------------------: | ----------: |
| Non-Module-Federation |                      -                      |             |
| Module Federation     |           Webpack<br />site.json            |             |
| Version Control       | Webpack<br />site.json<br />Registry Server |             |

## Examples

## Debugger/Logger

## Testing

## CLI

## Version Control

## Tutorial

## License

Fronts is MIT licensed.
