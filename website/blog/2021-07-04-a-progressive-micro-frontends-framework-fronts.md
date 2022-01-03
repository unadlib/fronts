---
slug: A progressive micro frontends framework - Fronts
title: A progressive micro frontends framework - Fronts
author: unadlib
tags: [fronts]
---

## Micro Frontends

> An architectural style where independently deliverable frontend applications are composed into a greater whole.

As front-end development becomes increasingly complex, traditional large front-end projects should likely end up being difficult to maintain due to over-coupling, and therefore Micro Frontends is also gaining attention in front-end architectures.

Front-end application modules dynamic will become one of the new trends in front-end development, and it will be possible to solve the problem of code base maintainability and delivery efficiency more thoroughly.

## Benefits and Value of Micro Frontends

-  Independence and Autonomy

Only if the overall process of application development can be developed, deployed and managed independently of the code base, etc., then the front-end project can have true independence guaranteed. And this possibility of team autonomy is also in line with Conway's Law, which states that "Any organization that designs a system (defined broadly) will produce a design whose structure is a copy of the organization's communication structure", thus bringing about a possible new form of organizational management.

- Technology Agnostic

Technology agnostic facilitates the collaboration of multiple teams with different technology stacks. The smooth migration of technology stacks also brings greater convenience to the continuous iteration and technology upgrade of the older business system.

- Runtime Integration

In modern front-end development processes, we most often see build-time integration. Whereas before, runtime integration happened to separate modules more independently. Micro frontends also happen to integrate well with such micro module concepts and keep such modules independent and dependency sharing.

- Decoupled Modularity & Composable

In large front-end projects, we have high requirements for modular decoupling, often based on different types of divisions, such as business type modularity, technical service type modularity, and so on. The composable of individual micro frontends particles in turn allows for good module consistency and overall customization differentiation across multiple deliverable families, and can greatly reduce business duplication.

In general, the proper practice of micro frontends architecture will bring far-reaching value to the long-term maintenance of some large front-end projects.

## Motivation

Among the many micro frontends solutions, single-spa and Module Federation are the best of them.

single-spa is a micro frontends framework based on router configuration. The centralization of configuration brings some limitations, such as it is difficult to granulate nestable micro frontends, module granularity control, module sharing, and so on.

In 2019, Zack Jackson proposed and implemented Module Federation. Module Federation is a completely different concept from single-spa, and allows a JavaScript application to dynamically load code from another application. It completely solves the problem of code dependency sharing and runtime modularity. The idea is true - A game-changer in JavaScript architecture as mentioned in Zack Jackson's article. And it's currently supported by Webpack, Next.js, and Rollup.

Although the Module Federation concept is so amazing, it has not yet gone further to provide a more complete and fully targeted micro frontends framework implementation, and this is what Fronts is trying to do.

## Hotspots of Micro Frontends Framework

Based on the current mainstream micro frontends frameworks or concepts, the following is a compilation of the main hotspots involved.

- Should the granularity level be application level or module level

Module level is obviously more advantageous in terms of flexibility and granularity, but there is clearly an advantage to supporting application level in order to be compatible with some not so modern front-end projects, so we need a framework that supports both. If application-level runtime integration is required, it is clear that just using Module Federation's Webpack is not enough, we also need a runtime application-level granular entry point loader.

- Whether the entry point file is HTML or JavaScript

From a modern engineering perspective, most front-end application entry points are JS-based, and some previous front-end projects have used HTML alone as the entry point. The trade-off is that building a micro frontends system for applications where HTML is the main entry point is bound to be a longer and more complex of processes. Such a library would be better suited as a standalone sub-package, while the overall framework should take JS files as the entry point.

- Is it necessary to support perfect module sharing

Module sharing is a problem that must be solved by micro frontends frameworks, otherwise the duplication of resources at runtime will make micro frontends less valuable. Currently, only Webpack with Module Federation allows such module sharing to be handled at build time, with dynamic dependency sharing at runtime. No better solution than Module Federation has yet emerged.

- CSS/JS isolation trade-off

Isolation of CSS is almost required and is supported by many micro frontends frameworks. We may have to do all kinds of hijacking to ensure the security, performance and stability, and also consider the compatibility of different browsers. However, JS isolation is relatively expensive to implement, and the fact that such isolation is required for modern front-end engineering depends on the actual situation of each micro frontend.

- Generic micro frontend and support multiple containers with multiple modes (Or SSR, etc.)

In large front-end projects, it is often not just about building a single web application, but possibly multiple web applications, or even more front-end application types, such as Electron applications, browser extensions, native applications, etc. So a good micro frontends framework should be able to run more kinds of containers and build a variety of application types, but also preferably compatible with building traditional SPA and micro frontends applications. Module Federation also initially implemented in the next.js implementation of SSR support.

- Version control and dependency management

With rapid iteration and business growth, various module management becomes very important, so when a large front-end project practices micro frontends architecture at a later stage, version control and dependency management will become especially important, which will determine the delivery efficiency and maintainability.

To solve these problems, Fronts was created.

## What's Fronts


Fronts is a progressive micro frontends framework for building Web applications, and it's based on the module federation of Webpack.

Repo: [https://github.com/unadlib/fronts](https://github.com/unadlib/fronts)

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
- **Generic Communication** - Fronts provides concise and generic communication APIs, which supports almost all frontend environments.

## Benefits of Fronts

**Fronts is a concise and easy to understand micro frontends framework.**

Set `site.json` to define a micro frontend, similar to a `package.json` in Node.js.

```json
{
  "name": "app1",
  "exports": ["./src/bootstrap"],
  "dependencies": {
    // If version control is enabled,
    // here it looks like: `"app2": "1.0.0"`
    "app2": "http://localhost:3002/remoteEntry.js"
  },
  "shared": {
    "react": { "singleton": true },
    "react-dom": { "singleton": true }
  }
}
```

**Fronts is progressive.**

If every front-end application does not support Module Federation, it will still work well as a micro frontend, with on-demand runtime modes, and as projects are upgraded, they can gradually be made to support Module Federation and eventually version control can be enabled. With support for multiple granularity levels, build types, module types, shared types, runtime types, and communication types, Fronts can almost meet all kinds of micro frontends architectures.

**Fronts APIs are clean and simple.**

Fronts provides three sets of loaders `useApp()`, `useWebComponents()` and `useIframe()`. It also provides an micro frontend launcher `boot()` and a Webpack configuration generator `createWebpackConfig()`. With these APIs, you will be able to do micro frontends development quickly and efficiently.

## Example

We will build a micro frontends project based on Fronts, where `app1` is the main entry point and it will depend on `app2`.

> You can follow this article([React without create-react-app Webpack 5](https://dev.to/rogeliosamuel621/react-without-create-react-app-webpack-5-1b1o)) to quickly create `app1` and `app2` React projects.

Assuming you've completed these steps, let's get started with a quick taste of the wonderful micro frontends development of Fronts.

- Install `fronts-react` and `fronts-bundler` in the projects.

```shell
# with NPM
npm install fronts-react fronts-bundler

# or with Yarn
yarn add fronts-react fronts-bundler
```

- Set up `site.json` and `webpack.config.js` in the projects

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

- Define the default exported bootstrap function in `app2/src/bootstrap.jsx` and use `boot()` to get it booted.

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

- Load `app1/src/App.jsx` with `useApp()` to import `app2`.

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

Run `yarn start`, and `app2` is rendered as a micro frontend on `app1`.

Example repo：[https://github.com/unadlib/fronts-example](https://github.com/unadlib/fronts-example)

## Notes

- Built-in packages

The mainstream front-end frameworks are still React, Vue and Angular. When a micro frontend uses one of them, it is recommended to use Fronts' built-in packages, such as `fronts-react`, `fronts-vue` and `fronts-ng`, and when it comes to other frameworks not supported by the built-in packages or no framework, then please use `fronts`.

- Built-in Package API

Each built-in package contains three sets of loaders `useApp()`, `useWebComponents()`, `useIframe()`. `useApp()` provides loose CSS isolation, `useWebComponents()` provides strict CSS isolation, and `useIframe()` provides native strict CSS isolation and JS isolation.

- Version Control

Fronts does not have full version control suite support and currently only supports self-built registry server.

- Monorepo & TypeScript

Large front-end projects often mean a high level of complexity, so Fronts are well suited for use in a combination of technology stacks like Monorepo and TypeScript. You get a great development experience in type safety, code management and runtime integration. when each micro frontend is used as a Monorepo sub-package, you just run `SPA=true yarn start` and switch the micro frontends development mode to the traditional SPA development mode.

## Conclusion

The front-end architecture based on Fronts, Monorepo, and TypeScript will significantly improve codebase management, type safety, business development and delivery efficiency, and enable multiple combination of product business capabilities, high reuse and consistency of business code, and diversity of application types.

Every large front-end project that tries to implement micro frontends architecture has different or similar requirements, so by analyzing the demands and needs of their own large front-end projects and using them to build or choose their own micro front-end architecture, they can really solve their own main engineering problems.

With a general module concept based on Module Federation, Fronts tries to solve the main problems of micro frontends in a more targeted and systematic way, such as cross-framework, dependency sharing, dependency management, version control, compatibility with multiple runtime containers and patterns, etc.

Fronts wants to evolve from more micro frontends architecture requirements to an efficient micro frontends framework.

Repo: [https://github.com/unadlib/fronts](https://github.com/unadlib/fronts)
