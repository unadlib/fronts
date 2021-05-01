import React from 'react';
import { HashRouter, Route, Switch } from 'react-router-dom';
// import App2 from 'app2/src/App';
import Navigation from './Navigation';
import HomePage from './HomePage';
import { useIFrame, useApp } from 'fronts';
import {
  useIFrame as useIFrameWithReact,
  useApp as useAppWithReact,
  useWebComponents as useWebComponentsWithReact,
} from 'fronts-react';
import { useRef } from 'react';
import { useEffect } from 'react';

const App2 = React.lazy(() => import('app2/src/App'));

const routes = [
  {
    path: '/',
    component: HomePage,
    exact: true,
  },
  {
    path: '/app2',
    component: () => (
      // <App2 />
      <React.Suspense fallback={<div>Loading...</div>}>
        <App2 />
      </React.Suspense>
    ),
    exact: true,
  },
  {
    path: '/app4',
    component: () => {
      const App4 = useIFrameWithReact('app4');
      const ref = useRef(null);
      useEffect(() => {
        useIFrame('app4', {
          target: ref.current,
        });
      }, []);
      return (
        <>
          <div ref={ref} />
          <App4 />
        </>
      );
    },
    exact: true,
  },
  {
    path: '/app5',
    component: () => {
      // Vue
      // @ts-ignore
      const App5 = useAppWithReact(() => import('app5/src/main'));
      const App5UseWebComponent = useWebComponentsWithReact(
        // @ts-ignore
        () => import('app5/src/main'),
        {
          shadowMode: 'closed',
          useShadowDOM: true,
        }
      );
      return (
        <>
          <h1>useAppWithReact example</h1>
          <App5 />
          <h1>useWebComponentsWithReact example</h1>
          <App5UseWebComponent />
        </>
      );
    },
    exact: true,
  },
];

const App = () => (
  <HashRouter>
    <div>
      <h1>App 1</h1>
      <Navigation />
      <Switch>
        {routes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            component={route.component}
            exact={route.exact}
          />
        ))}
      </Switch>
    </div>
  </HashRouter>
);

export default App;
