import { CacheContainer } from './interface';

class LocalStorage implements CacheContainer {
  getItem(key: string) {
    return window.localStorage.getItem(key);
  }

  setItem(key: string, value: string) {
    window.localStorage.setItem(key, value);
  }
}

let storage: CacheContainer = new LocalStorage();

export const setCacheContainer = (cacheContainer: CacheContainer) => {
  storage = cacheContainer;
};

export const setCacheLink = (storageKey: string, depLink: string) => {
  // todo: check and fallback
  storage.setItem(storageKey, depLink);
};

export const getCacheLink = (storageKey: string) => storage.getItem(storageKey);
