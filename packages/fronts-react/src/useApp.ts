import { useEffect, useRef } from 'react';
import { DynamicImport, loadApp } from 'fronts';

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
