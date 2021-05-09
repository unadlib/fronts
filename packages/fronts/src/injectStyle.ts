export const injectStyle = (target: HTMLElement, name: string) => {
  const key = `__${name}__`;
  (window as any)[key] ??= {};
  const appConfig: {
    insertedStyleElements?: HTMLStyleElement[];
    insertedStyleTargets?: HTMLElement[];
  } = (window as any)[key];
  appConfig.insertedStyleElements ??= [];
  appConfig.insertedStyleTargets ??= [];
  // collections from `style-loader` insert CSS element
  // If using a style dynamic solution, such as `styled-components`, and be sure to use `StyleSheetManager`.
  if (!appConfig.insertedStyleTargets.includes(target)) {
    appConfig.insertedStyleTargets.push(target);
  }
  const inserted: Record<string, boolean> = {};
  appConfig.insertedStyleElements.forEach((style) => {
    if (!inserted[style.innerText]) {
      inserted[style.innerText] = true;
      target.appendChild(style.cloneNode(true));
    }
  });
};
