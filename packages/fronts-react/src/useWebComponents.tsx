import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import {
  loadApp,
  Render,
  defineCustomElement,
  insertStyle,
  unmount,
} from 'fronts';
import { AppWrapper, UseWebComponents } from './interface';

// TODO: fix event with `react-shadow-dom-retarget-events`
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
  const App: AppWrapper<any> = useCallback(
    memo((props) => {
      useEffect(() => {
        if (typeof ModuleRef!.current!.default !== 'function') {
          throw new Error(
            `The current App should define default exported rendering functions in the dependent "${process.env.APP_NAME}" App.`
          );
        }
        const { node, injectedRoot } = defineCustomElement(options);
        let callback: void | (() => void);
        Promise.resolve().then(() => {
          insertStyle(injectedRoot, options.name);
          // TODO: pass `props`
          callback = ModuleRef!.current!.default(node);
        });
        return () => {
          unmount(injectedRoot, options.name);
          callback && callback();
        };
      }, []);
      return <fronts-app {...props} />;
    }),
    [loaded]
  );
  return loaded ? App : ({ fallback }) => fallback ?? null;
};
