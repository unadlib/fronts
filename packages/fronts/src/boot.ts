import { NodeElement, Render } from './interface';

export const boot = (render: Render, element: NodeElement, name?: string) => {
  if (!window.__FRONTS__DYNAMIC__IMPORT__) {
    render(element);
  }
  if (typeof name !== 'undefined') {
    if (typeof name !== 'string') {
      throw new Error(``);
    } else {
      window.__FRONTS__DYNAMIC__MODULES__ =
        window.__FRONTS__DYNAMIC__MODULES__ ?? {};
      window.__FRONTS__DYNAMIC__MODULES__[name] = { default: render };
      if (window.__FRONTS__FETCH__MODULES__?.[name]) {
        for (const fn of window.__FRONTS__FETCH__MODULES__?.[name]) {
          try {
            fn();
          } catch (e) {
            console.error(e);
          }
        }
      }
    }
  }
};
