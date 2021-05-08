import * as React from 'react';
// @ts-ignore
import styles from './styles.css';

const style = {
  padding: 12,
  backgroundColor: 'aquamarine',
};

const Button = () => {
  const [count, setCount] = React.useState(0);
  return (
    <button
      style={style}
      className={styles.button}
      onClick={() => setCount(count + 1)}
    >
      App 3 Button with count({count})
    </button>
  );
};

export default Button;
