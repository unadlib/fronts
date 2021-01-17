import { NodeElement, Render } from './interface';

export const boot = (render: Render, element: NodeElement) => {
  if (!window.__FRONTS__DYNAMIC__IMPORT__) {
    render(element);
  }
};
