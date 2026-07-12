import { createRoot } from 'react-dom/client';

import './styles.css';

function ProducerPage() {
  return (
    <main className="producer-page">
      <p className="eyebrow">Fronts 2.0 producer</p>
      <h1>React checkout remote</h1>
      <p>
        The application contract is exposed as <code>./application</code> through the official
        Module Federation Rsbuild plugin.
      </p>
    </main>
  );
}

const root = document.getElementById('root');
if (root !== null) {
  createRoot(root).render(<ProducerPage />);
}
