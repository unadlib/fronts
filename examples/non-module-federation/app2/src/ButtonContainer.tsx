import React, { useState } from 'react';
import App3 from 'app3/src/App';

const style = {
  padding: 12,
  backgroundColor: '#cccccc',
};

const ButtonContainer = () => {
  const [count, setCount] = useState(0);
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
