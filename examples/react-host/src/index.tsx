import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import { host } from './runtime.js';
import './styles.css';

const element = document.getElementById('root');
if (element !== null) {
  const root = createRoot(element);
  root.render(<App />);

  window.addEventListener(
    'beforeunload',
    () => {
      root.unmount();
      void host.dispose();
    },
    { once: true },
  );
}
