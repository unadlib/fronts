import { boot } from 'fronts';
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

export default function render(element: HTMLElement | null) {
  ReactDOM.render(<App />, element);
  return () => {
    ReactDOM.unmountComponentAtNode(element!);
  };
}

boot(render, document.getElementById('root'));
