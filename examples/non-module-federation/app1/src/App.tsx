import React from 'react';
import { HashRouter, Route, Switch } from 'react-router-dom';
import { loadScript, useApp } from 'fronts-react';
import Navigation from './Navigation';
import HomePage from './HomePage';

const routes = [
  {
    path: '/',
    component: HomePage,
    exact: true,
  },
  {
    path: '/about',
    component: () => {
      const App2 = useApp(() =>
        loadScript('http://localhost:3002/bundle.js', 'app2')
      );
      return <App2 />;
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
