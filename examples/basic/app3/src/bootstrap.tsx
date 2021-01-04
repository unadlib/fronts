import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

export default function render(element?: HTMLElement | null) {
  console.log('process.env.APP_NAME', process.env.APP_NAME);
  if (!element) return;
  ReactDOM.render(<App />, element);
  return () => {
    ReactDOM.unmountComponentAtNode(element!)
  };
}

render();
