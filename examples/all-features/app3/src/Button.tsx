import React, { useState } from 'react';
import { getAppName } from 'fronts';

const style = {
  padding: 12,
  backgroundColor: 'aquamarine',
};

const Button = () => {
  const [count, setCount] = useState(0);
  return (
    <button style={style} onClick={() => {
      setCount(count + 1);
      console.log(getAppName(), window.__FRONTS__);
    }}>
      App 3 Button with count({count})
    </button>
  );
};

export default Button;
