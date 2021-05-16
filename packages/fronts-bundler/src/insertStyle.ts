/* eslint-disable @typescript-eslint/ban-ts-comment */

import { identifier } from './constants';

export const insertStyle = (element: HTMLStyleElement | HTMLLinkElement) => {
  if (!window.__FRONTS__DYNAMIC__IMPORT__) {
    const parent = document.querySelector('head')!;
    const lastInsertedElement = window._lastElementInsertedByStyleLoader;
    if (!lastInsertedElement) {
      parent.insertBefore(element, parent.firstChild);
    } else if (lastInsertedElement.nextSibling) {
      parent.insertBefore(element, lastInsertedElement.nextSibling);
    } else {
      parent.appendChild(element);
    }
    window._lastElementInsertedByStyleLoader = element;
    return;
  }

  // Some plugins require that they be injected first, such as `mini-css-extract-plugin`/`extract-css-chunks-webpack-plugin`.
  if (element.tagName === 'LINK') {
    document.head.appendChild(element);
  }

  let key: string | undefined;
  try {
    key = `__${process.env.APP_NAME}__`;
  } catch (e) {
    if (element.tagName === 'LINK') {
      const map = Object.values(window[identifier]).reduce(
        (map, meta) => Object.assign(map, meta.dependencies),
        {} as Record<string, string>
      );
      for (const appName in map) {
        if ((element as HTMLLinkElement).href.includes(map[appName])) {
          key = `__${appName}__`;
        }
      }
    }
    if (!key) {
      throw e;
    }
  }
  (window as any)[key] ??= {};
  const insertedStyle: {
    elements?: (HTMLStyleElement | HTMLLinkElement)[];
    targets?: HTMLElement[];
  } = (window as any)[key];
  insertedStyle.elements ??= [];
  insertedStyle.targets ??= [];
  insertedStyle.elements.push(element);
  insertedStyle.targets.forEach((target) => {
    for (const item of Array.from(target.childNodes)) {
      if (
        ((element as HTMLStyleElement).tagName === 'STYLE' &&
          (item as HTMLStyleElement).tagName === 'STYLE' &&
          (item as HTMLStyleElement).innerText === element.innerText) ||
        ((element as HTMLLinkElement).tagName === 'LINK' &&
          (item as HTMLLinkElement).tagName === 'LINK' &&
          (item as HTMLLinkElement).href === (element as HTMLLinkElement).href)
      ) {
        return;
      }
    }
    target.appendChild(element);
  });
};
