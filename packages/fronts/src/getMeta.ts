import { getAppName } from './getAppName';

export const getMeta = () => {
  const info = {
    name: getAppName(),
    meta: window.__FRONTS__,
  };
  return info;
};
