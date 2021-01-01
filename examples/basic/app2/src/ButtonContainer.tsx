import React, { useEffect } from 'react';
import App3 from 'app3/src/App';

const style = {
  padding: 12,
  backgroundColor: '#cccccc',
};

const ButtonContainer = () => {
  useEffect(() => {
    // @ts-ignore
    import(`app3/bootstrap`).then((e: any) => {
      e.default?.();
    });
  }, []);
  return (
    <div style={style}>
      App 2 Container
      <br />
      <br />
      <div id="app3/bootstrap"></div>
      {/* <App3 /> */}
    </div>
  );
};

export default ButtonContainer;
