/* eslint-disable @typescript-eslint/ban-types */
import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import {
  loadApp,
  Render,
  defineCustomElement,
  injectStyle,
  unmount,
  retargetEvents,
} from 'fronts';
import { AppWrapper, UseWebComponents } from './interface';

/**
 *
 */
export const useWebComponents: UseWebComponents = (options) => {
  const ModuleRef = useRef<{ default: Render } | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    loadApp(options.loader, options.name).then((module: any) => {
      setLoaded(true);
      ModuleRef.current = module;
    });
  }, []);
  const App: AppWrapper<{}> = useCallback(
    memo(() => {
      useEffect(() => {
        if (typeof ModuleRef!.current!.default !== 'function') {
          throw new Error(
            `The current App should define default exported rendering functions in the dependent "${process.env.APP_NAME}" App.`
          );
        }
        const { node, injectedRoot } = defineCustomElement(options);
        let callback: void | (() => void);
        Promise.resolve().then(() => {
          injectStyle(injectedRoot, options.name);
          const attributes: Record<string, any> = options.attrs ?? {};
          for (const key in attributes) {
            node.setAttribute(key, attributes[key]);
          }
          callback = ModuleRef!.current!.default(node, options.props ?? {});
          if (options.retargetEvent) {
            retargetEvents(injectedRoot);
          }
        });
        return () => {
          unmount(injectedRoot, options.name);
          callback && callback();
        };
      }, []);
      return <fronts-app />;
    }),
    [loaded]
  );
  return loaded ? App : ({ fallback }) => fallback ?? null;
};
