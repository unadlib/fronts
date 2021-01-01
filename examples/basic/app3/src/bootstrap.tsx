import App from './App';
import React from 'react';
import ReactDOM from 'react-dom';

if (!document.getElementById(process.env.APP_NAME!)) {
  ReactDOM.render(<App />, document.getElementById('root'));
}

export default function () {
  ReactDOM.render(<App />, document.getElementById(process.env.APP_NAME!));
}
