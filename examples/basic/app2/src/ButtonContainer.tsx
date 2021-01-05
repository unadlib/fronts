import React, { useEffect, useRef } from 'react';
// import { loadApp } from '../../../../packages/phare';
// import { useApp } from '../../../../packages/phare-react';
import App3 from 'app3/src/App';

const style = {
  padding: 12,
  backgroundColor: '#cccccc',
};

const ButtonContainer = () => {
  // const ref = useApp(() => import('app3/src/bootstrap'));
  return (
    <div style={style}>
      App 2 Container
      <br />
      <br />
      {/* <div ref={ref}></div> */}
      <App3 />
    </div>
  );
};

export default ButtonContainer;
