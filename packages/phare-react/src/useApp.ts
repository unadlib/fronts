import { useEffect, useRef } from 'react';
import { DynamicImport } from './interface';
import { loadApp } from './loadApp';

export const useApp = (dynamicImport: DynamicImport) => {
  const ref = useRef(null);
  useEffect(() => {
    let callback: (() => void) | void;
    loadApp(dynamicImport, ref.current).then((unmount) => {
      callback = unmount;
    });
    return () => callback && callback();
  }, []);
  return ref;
};
