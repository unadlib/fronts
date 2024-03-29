import { getUid } from './getUid';
import { injectStyle } from './injectStyle';
import { DefineCustomElementOptions, UseWebComponents } from './interface';
import { loadApp } from './loadApp';
import { retargetEvents } from './retargetEvents';
import { unmount } from './unmount';

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
      mode: options.shadowMode ?? 'open',
    });
    shadow.appendChild(node);
    injectedRoot = shadow;
  } else {
    customElementInstance.appendChild(node);
    injectedRoot = customElementInstance;
  }
  return { node, injectedRoot };
};

/**
 *
 */
export const useWebComponents: UseWebComponents = (options) => {
  return loadApp(options.loader, options.name).then((module) => {
    if (typeof module.default !== 'function') {
      throw new Error(
        `The current App should define default exported rendering functions.`
      );
    }
    const customElement = document.createElement('fronts-app');
    const uid = getUid(options.name);
    customElement.setAttribute('data-fronts', uid);
    options.target.appendChild(customElement);
    const { node, injectedRoot } = defineCustomElement({
      shadowMode: options.shadowMode,
      useShadowDOM: options.useShadowDOM,
      name: options.name,
    });
    injectStyle(injectedRoot, options.name);
    const attributes: Record<string, any> = options.attrs ?? {};
    for (const key in attributes) {
      node.setAttribute(key, attributes[key]);
    }
    const callback = module.default(node, options.props ?? {});
    if (options.retargetEvent) {
      retargetEvents(injectedRoot);
    }
    return () => {
      unmount(injectedRoot, options.name);
      callback && callback();
    };
  });
};
