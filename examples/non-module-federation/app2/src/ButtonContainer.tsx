import React, { useState, useRef, useEffect } from 'react';
import { useWebComponents, loadScript } from 'fronts';
import { useWebComponents as useWebComponentsWithReact } from 'fronts-react';

const style = {
  padding: 12,
  backgroundColor: '#cccccc',
};

const ButtonContainer = () => {
  const [count, setCount] = useState(0);

  const ref = useRef(null);
  useEffect(() => {
    let callback: (() => void) | void;
    useWebComponents(
      () => loadScript('http://localhost:3003/bundle.js', 'app3'),
      {
        target: ref.current,
      }
    ).then((unmount) => {
      callback = unmount;
    });
    return () => callback && callback();
  }, []);

  const App3 = useWebComponentsWithReact(() =>
    loadScript('http://localhost:3003/bundle.js', 'app3')
  );

  return (
    <div style={style}>
      App 2 Container
      <button type="button" onClick={() => setCount(count + 1)}>
        {count}
      </button>
      <br />
      <br />
      <h1>useWebComponents example</h1>
      <div ref={ref}></div>
      <br />
      <br />
      <h1>useWebComponentsWithReact example</h1>
      <App3 />
    </div>
  );
};

export default ButtonContainer;
