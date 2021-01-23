import React, { FC } from 'react';
import ButtonContainer from './ButtonContainer';

const App: FC<{ version?: string }> = () => (
  <div>
    <h1>Nested</h1>
    <h2>App 2</h2>
    <ButtonContainer />
  </div>
);

export default App;
