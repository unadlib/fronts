import React, { useState, useEffect, useRef } from 'react';
import {
  useApp as useAppWithReact,
  useWebComponents as useWebComponentsWithReact,
  useIframe as useIframeWithReact,
} from 'fronts-react';
import { useApp, useWebComponents, useIframe } from 'fronts';

const style = {
  padding: 12,
  backgroundColor: '#cccccc',
};

const App3 = React.lazy(() => import(`app3/src/App`));

const ButtonContainer = () => {
  const [count, setCount] = useState(0);

  const ref = useRef(null);
  useEffect(() => {
    let callback: (() => void) | void;
    useApp({
      name: 'app3',
      loader: () => import('app3/src/bootstrap'),
      target: ref.current!,
    }).then((unmount) => {
      callback = unmount;
    });
    return () => callback && callback();
  }, []);

  const App3WithReact = useAppWithReact({
    name: 'app3',
    loader: () => import('app3/src/bootstrap'),
  });

  const ref1 = useRef(null);
  useEffect(() => {
    let callback: (() => void) | void;
    useWebComponents({
      name: 'app3',
      target: ref1.current!,
      useShadowDOM: true,
      loader: () => import('app3/src/bootstrap'),
    }).then((unmount) => {
      callback = unmount;
    });
    return () => callback && callback();
  }, []);

  const App3WebComponentWithReact = useWebComponentsWithReact({
    name: 'app3',
    useShadowDOM: true,
    shadowMode: 'closed',
    loader: () => import('app3/src/bootstrap'),
  });

  const ref2 = useRef(null);
  useEffect(() => {
    useIframe({
      name: 'app3',
      target: ref2.current!,
    });
  }, []);

  const App3UseIframeWithReact = useIframeWithReact({ name: 'app3' });
  return (
    <div style={style}>
      App 2 Container
      <button type="button" onClick={() => setCount(count + 1)}>
        {count}
      </button>
      <br />
      <br />
      <h1>Inline as React Component example</h1>
      <App3 />
      <br />
      <br />
      <h1>useApp example</h1>
      <div ref={ref}></div>
      <br />
      <br />
      <h1>useAppWithReact example</h1>
      <App3WithReact />
      <br />
      <br />
      <h1>useWebComponent example</h1>
      <div ref={ref1}></div>
      <br />
      <br />
      <h1>useWebComponentWithReact example</h1>
      <App3WebComponentWithReact />
      <br />
      <br />
      <h1>useIframe example</h1>
      <div ref={ref2}></div>
      <br />
      <br />
      <h1>useIframeWithReact example</h1>
      <App3UseIframeWithReact />
    </div>
  );
};

export default ButtonContainer;
