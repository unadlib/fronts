import React, { useState } from 'react';
import { useApp, loadAppScript } from 'fronts-react';

const style = {
  padding: 12,
  backgroundColor: '#cccccc',
};

const ButtonContainer = () => {
  const [count, setCount] = useState(0);
  // @ts-ignore
  const App3 = useApp(() =>
    // @ts-ignore
    loadAppScript('http://localhost:3003/bundle.js', 'app3')
  );
  return (
    <div style={style}>
      App 2 Container
      <button type="button" onClick={() => setCount(count + 1)}>
        {count}
      </button>
      <br />
      <br />
      <App3 />
    </div>
  );
};

export default ButtonContainer;
