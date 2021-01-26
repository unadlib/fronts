import React from 'react';
import { HashRouter, Route, Switch } from 'react-router-dom';
// import App2 from 'app2/src/App';
import Navigation from './Navigation';
import HomePage from './HomePage';
import { useIFrame, useApp } from 'fronts';
import {
  useIFrame as useReactIFrame,
  useIFrame as useReactApp,
} from 'fronts-react';

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
      const App4 = useReactIFrame('app4');
      return <App4 />;
    },
    exact: true,
  },
  // {
  //   path: '/app6',
  //   component: () => <iframe src={useIFrame('app6')} />,
  //   exact: true,
  // },
  // {
  //   path: '/app4',
  //   component: () => {
  //     // Vue
  //     const App4 = useReactApp(() => import('app4'));
  //     return <App4 />;
  //   },
  //   exact: true,
  // },
  // {
  //   path: '/app5',
  //   component: () => {
  //     // ng
  //     const App5 = useReactApp(() => import('app5'));
  //     return <App5 />;
  //   },
  //   exact: true,
  // },
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
