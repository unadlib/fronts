import { injectScript } from './injectScript';
import { Render } from './interface';

/**
 * Loading script with non-module-federation module
 */
export const loadScript = (url: string) => (name: string) =>
  new Promise<{
    default: Render;
  }>((resolve, reject) => {
    const app = window.__FRONTS__DYNAMIC__MODULES__?.[name];
    if (typeof app !== 'undefined') {
      // Script have already been loaded.
      return resolve(app);
    }

    const onLoadApp = () => {
      const app = window.__FRONTS__DYNAMIC__MODULES__?.[name];
      resolve(app);
      window.__FRONTS__FETCH__MODULES__[name].delete(onLoadApp);
    };
    window.__FRONTS__FETCH__MODULES__ = window.__FRONTS__FETCH__MODULES__ ?? {};
    window.__FRONTS__FETCH__MODULES__[name] =
      window.__FRONTS__FETCH__MODULES__[name] ?? new Set();
    window.__FRONTS__FETCH__MODULES__[name].add(onLoadApp);

    injectScript({
      url,
      reject,
    });
  });
