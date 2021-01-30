import { useState } from 'react';
import * as React from 'react';

const style = {
  padding: 12,
  backgroundColor: 'aquamarine',
};

const Button = () => {
  const [count, setCount] = React.useState(0);
  return (
    <button style={style} onClick={() => setCount(count + 1)}>
      App 3 Button with count({count})
    </button>
  );
};

export default Button;
