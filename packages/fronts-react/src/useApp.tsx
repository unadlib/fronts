/* eslint-disable @typescript-eslint/ban-types */
import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { getUid, injectStyle, loadApp, Render, unmount } from 'fronts';
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
  const App: AppWrapper<{}> = useCallback(
    memo(() => {
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
          injectStyle(rootRef.current!, options.name);
          callback = ModuleRef!.current!.default(
            renderRef.current,
            options.props ?? {}
          );
        });
        return () => {
          unmount(rootRef.current!, options.name);
          callback && callback();
        };
      }, []);
      const uid = getUid(options.name);
      return (
        <div ref={rootRef} data-fronts={uid} {...options.attrs}>
          <div ref={renderRef}></div>
        </div>
      );
    }),
    [loaded]
  );
  return loaded ? App : ({ fallback }) => fallback ?? null;
};
