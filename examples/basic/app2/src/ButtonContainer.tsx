import React, { useEffect, useRef } from 'react';
import { loadApp } from '../../../../packages/phare';
// import App3 from 'app3/src/App';

const style = {
  padding: 12,
  backgroundColor: '#cccccc',
};

const ButtonContainer = () => {
  const ref = useRef(null);
  useEffect(() => {
    let callback: (() => void) | void;
    loadApp(() => import('app3/src/bootstrap'), ref.current).then((unmount) => {
      callback = unmount;
    });
    return () => callback && callback();
  }, []);
  return (
    <div style={style}>
      App 2 Container
      <br />
      <br />
      <div ref={ref}></div>
      {/* <App3 /> */}
    </div>
  );
};

export default ButtonContainer;
