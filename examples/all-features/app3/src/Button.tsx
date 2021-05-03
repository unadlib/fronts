import React, { useState } from 'react';
import { getMeta } from 'fronts';

const style = {
  padding: 12,
  backgroundColor: 'aquamarine',
};

const Button = () => {
  const [count, setCount] = useState(0);
  return (
    <button style={style} onClick={() => {
      setCount(count + 1);
      console.log(getMeta());
    }}>
      App 3 Button with count({count})
    </button>
  );
};

export default Button;
