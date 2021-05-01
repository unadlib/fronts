import React, { useState, useEffect, useRef } from 'react';
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
    useApp(() => import('app3/src/bootstrap'), ref.current).then((unmount) => {
      callback = unmount;
    });
    return () => callback && callback();
  }, []);

  const ref1 = useRef(null);
  useEffect(() => {
    let callback: (() => void) | void;
    useWebComponents(() => import('app3/src/bootstrap'), {
      target: ref1.current,
      shadowMode: 'open',
      useShadowDOM: true,
    }).then((unmount) => {
      callback = unmount;
    });
    return () => callback && callback();
  }, []);

  return (
    <div style={style}>
      App 2 Container
      <button type="button" onClick={() => setCount(count + 1)}>
        {count}
      </button>
      <br />
      <br />
      <div ref={ref}></div>
      <br />
      <br />
      <h1>useWebComponents example</h1>
      <div ref={ref1}></div>
    </div>
  );
};

export default ButtonContainer;
