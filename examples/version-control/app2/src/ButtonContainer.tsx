import React, { useState, useEffect, useRef } from 'react';
import App3 from 'app3/src/App';
import { useApp as useAppWithReact, useWebComponents as useWebComponentsWithReact } from 'fronts-react';
import { useApp, useWebComponents } from 'fronts';

const style = {
  padding: 12,
  backgroundColor: '#cccccc',
};

const ButtonContainer = () => {
  const [count, setCount] = useState(0);

  const ref = useRef(null);
  useEffect(() => {
    let callback: (() => void) | void;
    useApp(() => import('app3/src/bootstrap'), {
      target: ref.current,
    }).then((unmount) => {
      callback = unmount;
    });
    return () => callback && callback();
  }, []);

  const App3WithReact = useAppWithReact(() => import('app3/src/bootstrap'));

  const ref1 = useRef(null);
  useEffect(() => {
    let callback: (() => void) | void;
    useWebComponents(() => import('app3/src/bootstrap'), {
      target: ref1.current,
    }).then((unmount) => {
      callback = unmount;
    });
    return () => callback && callback();
  }, []);

  const App3WebComponentWithReact = useWebComponentsWithReact(() => import('app3/src/bootstrap'));
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
    </div>
  );
};

export default ButtonContainer;
