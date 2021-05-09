import { InsertedStyle } from './interface';

export const injectStyle = (target: HTMLElement, name: string) => {
  const key = `__${name}__`;
  (window as any)[key] ??= {};
  const insertedStyle: InsertedStyle = (window as any)[key];
  insertedStyle.elements ??= [];
  insertedStyle.targets ??= [];
  // collections from `style-loader` insert CSS element
  // If using a style dynamic solution, such as `styled-components`, and be sure to use `StyleSheetManager`.
  if (!insertedStyle.targets.includes(target)) {
    insertedStyle.targets.push(target);
  }
  const inserted: Record<string, boolean> = {};
  insertedStyle.elements.forEach((style) => {
    if (style.tagName === 'LINK') {
      try {
        // Remove some of the styles injected in advance, such as `mini-css-extract-plugin`/`extract-css-chunks-webpack-plugin`.
        document.head.removeChild(style);
      } catch (e) {
        //
      }
    }

    const key = (style as HTMLLinkElement).href || style.innerText;
    if (!inserted[key]) {
      inserted[key] = true;
      target.appendChild(style.cloneNode(true));
    }
  });
};
