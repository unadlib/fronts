import React, { useState, useEffect, useRef } from 'react';
// import App3 from 'app3/src/App';
import { useApp } from 'fronts-react';
// import { loadApp } from 'fronts';

const style = {
  padding: 12,
  backgroundColor: '#cccccc',
};

const ButtonContainer = () => {
  const [count, setCount] = useState(0);

  // const ref = useRef(null);
  // useEffect(() => {
  //   let callback: (() => void) | void;
  //   loadApp(() => import('app3/src/bootstrap'), ref.current).then((unmount) => {
  //     callback = unmount;
  //   });
  //   return () => callback && callback();
  // }, []);

  const App3 = useApp(() => import('app3'));
  return (
    <div style={style}>
      App 2 Container
      <button type="button" onClick={() => setCount(count + 1)}>
        {count}
      </button>
      <br />
      <br />
      {/* <div ref={ref}></div> */}
      <App3 />
    </div>
  );
};

export default ButtonContainer;
