# fronts

A progressive micro frontends framework for building Web applications, and it's based on the module federation of Webpack.

## Motivation

## Concepts

## Features

- **Non-module-federation**
- **Decentralized configuration**
- **Cross framework**
- **Code splitting**
- **CSS isolation**
- **Lazy Loading**
- **Lifecycle**
- **iFrame & Web Components**
- **Multiple patterns** - Quick Switch as Micro Frontends or Internal Reference
- **Monorepo & TypeScript**
- **Version control**
- **Zero hijacking**

## Getting Started

You can use `npx create-react-app app1` and `npx create-react-app app2` to quickly create `app1` and `app2` React projects and run `npm run eject` to get `webpack.config.js`, and upgrade `webpack` to version 5.0.

Assuming you've completed these steps, let's get started with a quick taste of the wonderful micro frontends development of Fronts.

1. Installation in the projects

```shell
yarn install fronts-react fronts-bundler
```

2. Set up `site.json` and `webpack.config.js` in the projects

We define `app1` as a parent micro frontend and it depends on the `app2` micro frontend.

```json
{
  "name": "app1",
  "exports": [],
  "dependencies": {
    "app2": "http://localhost:3002/remoteEntry.js"
  }
}
```

`app2` doesn't have any dependencies, it acts as a micro frontend and we define it to export `. /src/bootstrap`, this entry of `app2` end will be used by `app1`.

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

```tsx
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

```tsx
import React from 'react';
import ReactDOM from 'react-dom';
import { boot } from 'fronts-react';
import App from './App';

export default function render(element: HTMLElement | null) {
  ReactDOM.render(<App />, element);
  return () => {
    ReactDOM.unmountComponentAtNode(element!);
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

## Tutorial

## License

Fronts is MIT licensed.
