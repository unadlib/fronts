import { DefineCustomElementOptions, UseWebComponents } from './interface';
import { loadApp } from './loadApp';

// https://github.com/webcomponents/polyfills/tree/master/packages/webcomponentsjs#custom-elements-es5-adapterjs
window.__FRONTS_CUSTOM_ELEMENTS_INSTANCES__ = new Set();

export const defineCustomElement = (options: DefineCustomElementOptions) => {
  if (!customElements.get('fronts-app')) {
    customElements.define(
      'fronts-app',
      eval(`() => class Fronts extends HTMLElement {
        constructor() {
          super();
          window.__FRONTS_CUSTOM_ELEMENTS_INSTANCES__.add(this);
        }

        disconnectedCallback() {
          window.__FRONTS_CUSTOM_ELEMENTS_INSTANCES__.delete(this);
        }
      }`)()
    );
  }
  const node = document.createElement('div');
  const customElementInstances = window.__FRONTS_CUSTOM_ELEMENTS_INSTANCES__;
  const customElementInstance = customElementInstances.values().next().value;
  customElementInstances.delete(customElementInstance);
  let injectedRoot: HTMLElement;
  if (options.useShadowDOM) {
    const shadow = customElementInstance.attachShadow({
      mode: options.shadowMode,
    });
    shadow.appendChild(node);
    injectedRoot = shadow;
  } else {
    customElementInstance.appendChild(node);
    injectedRoot = customElementInstance;
  }
  if (options.name) {
    const insertedStyleKey = `__${options.name}_inserted_style__`;
    // collections from `style-loader` insert CSS element
    // If using a style dynamic solution, such as `styled-components`, and be sure to use `StyleSheetManager`.
    const styles: HTMLElement[] | undefined = (window as any)[insertedStyleKey];
    if (styles) {
      styles.forEach((style) => {
        injectedRoot.appendChild(style.cloneNode(true));
      });
    }
  }
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
