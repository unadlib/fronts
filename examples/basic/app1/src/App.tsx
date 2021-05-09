import React from 'react';
import { HashRouter, Route, Switch } from 'react-router-dom';
import { useApp, loadScript } from 'fronts-react';
// import App2 from 'app2/src/App';
import Navigation from './Navigation';
import HomePage from './HomePage';

const App2 = React.lazy(() => import('app2/src/App'));

const routes = [
  {
    path: '/',
    component: HomePage,
    exact: true,
  },
  {
    path: '/about',
    component: () => (
      // <App2 />
      <React.Suspense fallback={<div>Loading...</div>}>
        <App2 />
      </React.Suspense>
    ),
    exact: true,
  },
];




const App = () => {
  const App4 = useApp({
    name: 'app4',
    loader: loadScript('http://localhost:3004/bundle.js'),
  });
  return (
    <HashRouter>
    <div>
      <h1>App 4 with Non-Module-Federation</h1>
      <App4 />
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
  )
};

export default App;
