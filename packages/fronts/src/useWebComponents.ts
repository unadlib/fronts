import { DefineCustomElementOptions, UseWebComponents } from './interface';
import { loadApp } from './loadApp';

export const defineCustomElement = (options: DefineCustomElementOptions) => {
  if (!customElements.get('fronts-app')) {
    customElements.define(
      'fronts-app',
      eval(`() => class Fronts extends HTMLElement {
        constructor() {
          super();
          window.__FRONTS__RENDER_WEB_COMPONENT__ = function(options) {
            var shadow = options.useShadowDOM && this.attachShadow({mode: options.shadowMode });
            if (shadow) {
              shadow.appendChild(options.node);
            } else {
              this.appendChild(options.node);
            }
          }.bind(this)
        }
      }`)()
    );
  }
  const node = document.createElement('div');
  window.__FRONTS__RENDER_WEB_COMPONENT__({
    node,
    shadowMode: options?.shadowMode ?? 'open',
    useShadowDOM: options?.useShadowDOM ?? false,
  });
  return node;
};

export const useWebComponents: UseWebComponents = (dynamicImport, options) => {
  return loadApp(dynamicImport).then((module) => {
    if (typeof module.default !== 'function') {
      throw new Error(
        `The current App should define default exported rendering functions.`
      );
    }
    const customElement = document.createElement('fronts-app');
    options.target?.appendChild(customElement);
    const node = defineCustomElement({
      shadowMode: options.shadowMode,
      useShadowDOM: options.useShadowDOM,
    });
    // TODO: pass `props`
    return module.default(node);
  });
};
