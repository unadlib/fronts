import { DynamicImport, NodeElement, UseWebComponentsOptions, WebComponentsOptions } from './interface';
import { loadApp } from './loadApp';

const webComponentsOptions: WebComponentsOptions = {
  node: null,
  useShadowDOM: false,
  shadowMode: 'open',
};

export const useWebComponents = (
  dynamicImport: DynamicImport,
  options: UseWebComponentsOptions
) => {
  return loadApp(dynamicImport).then((module) => {
    if (typeof module.default !== 'function') {
      throw new Error(
        `The current App should define default exported rendering functions.`
      );
    }
    Object.assign(webComponentsOptions, {
      node: document.createElement('div'),
      useShadowDOM: options.shadowMode ?? false,
      shadowMode: options.shadowMode ?? 'open',
    });
    const node = document.createElement('fronts-app');
    options.target?.appendChild(node);
    if (!customElements.get('fronts-app')) {
      customElements.define(
        'fronts-app',
        // use `setTimeout` for waiting React render the wrapper component
        eval(`(options) => class Fronts extends HTMLElement {
          constructor() {
            super();
            var shadow = options.useShadowDOM && this.attachShadow({mode: options.shadowMode });
            setTimeout(() => {
              if (shadow) {
                shadow.appendChild(options.node);
              } else {
                this.appendChild(options.node);
              }
            });
          }

          disconnectedCallback() {
            options.node = null;
          }
        }`)(webComponentsOptions)
      );
    }
    // TODO: pass `props`
    return module.default(webComponentsOptions.node);
  });
};
