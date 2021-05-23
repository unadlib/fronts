import { identifier } from './constants';
import { getAppName } from './getAppName';

export const getMeta = () => {
  // TODO: uuid
  const info = {
    name: getAppName(),
    meta: window[identifier],
  };
  return info;
};
