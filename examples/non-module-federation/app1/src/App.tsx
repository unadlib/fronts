import React, { useRef, useEffect } from 'react';
import { HashRouter, Route, Switch } from 'react-router-dom';
import { loadScript, useApp as useAppWithReact } from 'fronts-react';
import { useApp } from 'fronts';
import Navigation from './Navigation';

const routes = [
  {
    path: '/',
    component: () => {
      const ref = useRef(null);
      useEffect(() => {
        let callback: (() => void) | void;
        useApp(() => loadScript('http://localhost:3002/bundle.js', 'app2'), {
          target: ref.current,
        }).then((unmount) => {
          callback = unmount;
        });
        return () => callback && callback();
      }, []);
      return (
        <>
          <h1>useApp Example</h1>
          <div ref={ref} />
        </>
      );
    },
    exact: true,
  },
  {
    path: '/about',
    component: () => {
      const App2 = useAppWithReact(() =>
        loadScript('http://localhost:3002/bundle.js', 'app2')
      );
      return (
        <div>
          <h1>useAppWithReact Example</h1>
          <App2 />
        </div>
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
