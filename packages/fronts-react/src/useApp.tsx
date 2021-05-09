import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { insertStyle, loadApp, Render } from 'fronts';
import { AppWrapper, UseApp } from './interface';

/**
 *
 */
export const useApp: UseApp = (options) => {
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
      const rootRef = useRef<HTMLDivElement>(null);
      const renderRef = useRef<HTMLDivElement>(null);
      useEffect(() => {
        if (typeof ModuleRef!.current!.default !== 'function') {
          throw new Error(
            `The current App should define default exported rendering functions in the dependent "${process.env.APP_NAME}" App.`
          );
        }
        let callback: void | (() => void);
        Promise.resolve().then(() => {
          insertStyle(rootRef.current!, options.name);
          // TODO: pass `props`
          callback = ModuleRef!.current!.default(renderRef.current);
        });
        return () => callback && callback();
      }, []);
      return (
        <div
          ref={rootRef}
          data-fronts={options?.name}
          data-render={Date.now()}
          {...props}
        >
          <div ref={renderRef}></div>
        </div>
      );
    }),
    [loaded]
  );
  return loaded ? App : ({ fallback }) => fallback ?? null;
};
