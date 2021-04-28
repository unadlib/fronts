import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { DynamicImport, loadApp, Render } from 'fronts';
import { AppWrapper } from './interface';

export const useApp: <T extends { [k: string]: any } = { [k: string]: any }>(
  dynamicImport: DynamicImport
) => AppWrapper<T> = (dynamicImport) => {
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
      const ref = useRef(null);
      useEffect(() => {
        if (typeof ModuleRef!.current!.default !== 'function') {
          throw new Error(
            `The current App should define default exported rendering functions in the dependent "${process.env.APP_NAME}" App.`
          );
        }
        // TODO: pass `props`
        return ModuleRef!.current!.default(ref.current);
      }, []);
      return <div ref={ref} {...props}></div>;
    }),
    [loaded]
  );
  return loaded ? App : ({ fallback }) => fallback ?? null;
};
