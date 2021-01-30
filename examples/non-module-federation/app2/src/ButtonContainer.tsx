import React, { useState, useRef, useEffect } from 'react';
import { useApp, loadScript } from 'fronts';

const style = {
  padding: 12,
  backgroundColor: '#cccccc',
};

const ButtonContainer = () => {
  const [count, setCount] = useState(0);

  const ref = useRef(null);
  useEffect(() => {
    let callback: (() => void) | void;
    useApp(() => loadScript('http://localhost:3003/bundle.js', 'app3'), ref.current).then((unmount) => {
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
    </div>
  );
};

export default ButtonContainer;
