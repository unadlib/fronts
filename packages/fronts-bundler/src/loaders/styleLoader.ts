/* eslint-disable @typescript-eslint/ban-ts-comment */

export const insertStyle = (element: HTMLStyleElement) => {
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

  const key = `__${process.env.APP_NAME}__`;
  (window as any)[key] ??= {};
  const appConfig: {
    insertedStyleElements?: HTMLStyleElement[];
    insertedStyleTargets?: HTMLElement[];
  } = (window as any)[key];
  appConfig.insertedStyleElements ??= [];
  appConfig.insertedStyleTargets ??= [];
  appConfig.insertedStyleElements.push(element);
  appConfig.insertedStyleTargets.forEach((target) => {
    for (const item of Array.from(target.childNodes)) {
      if (
        (item as HTMLElement).tagName === 'STYLE' &&
        (item as HTMLStyleElement).innerText === element.innerText
      ) {
        return;
      }
    }
    target.appendChild(element);
  });
};
