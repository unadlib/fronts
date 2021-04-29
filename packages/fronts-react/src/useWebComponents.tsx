import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { DynamicImport, loadApp, Render } from 'fronts';
import {
  AppWrapper,
  UseWebComponentsOptions,
  WebComponentsOptions,
} from './interface';

// https://github.com/webcomponents/polyfills/tree/master/packages/webcomponentsjs#custom-elements-es5-adapterjs

const webComponentsOptions: WebComponentsOptions = {
  node: null,
  useShadowDOM: false,
  shadowMode: 'open',
};

export const useWebComponents: <
  T extends { [k: string]: any } = { [k: string]: any }
>(
  dynamicImport: DynamicImport,
  options?: UseWebComponentsOptions
) => AppWrapper<T> = (dynamicImport, options) => {
  const ModuleRef = useRef<{ default: Render } | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    loadApp(dynamicImport).then((module: any) => {
      setLoaded(true);
      ModuleRef.current = module;
    });
  }, []);
  const App: AppWrapper<any> = useCallback(
    memo((props) => {
      useEffect(() => {
        Object.assign(webComponentsOptions, {
          node: document.createElement('div'),
          useShadowDOM: false,
          shadowMode: 'open',
          ...options,
        });
        if (typeof ModuleRef!.current!.default !== 'function') {
          throw new Error(
            `The current App should define default exported rendering functions in the dependent "${process.env.APP_NAME}" App.`
          );
        }
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
        return ModuleRef!.current!.default(webComponentsOptions.node);
      }, []);
      return <fronts-app />;
    }),
    [loaded]
  );
  return loaded ? App : ({ fallback }) => fallback ?? null;
};
