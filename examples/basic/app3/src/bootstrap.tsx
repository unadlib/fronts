import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

export default function render(element: HTMLElement | null) {
  ReactDOM.render(<App />, element);
  return () => {
    ReactDOM.unmountComponentAtNode(element!)
  };
}

if (!(window as any).__APP__) {
  render(document.getElementById('root'));
}
