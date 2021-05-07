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
  const insertedStyleKey = `__${process.env.APP_NAME}_inserted_style__`;
  (window as any)[insertedStyleKey] = (window as any)[insertedStyleKey] ?? [];
  (window as any)[insertedStyleKey].push(element);
};
