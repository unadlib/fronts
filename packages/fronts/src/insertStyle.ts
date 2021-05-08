export const insertStyle = (target: HTMLElement, name: string) => {
  const insertedStyleKey = `__${name}_inserted_style__`;
  // collections from `style-loader` insert CSS element
  // If using a style dynamic solution, such as `styled-components`, and be sure to use `StyleSheetManager`.
  const styles: HTMLStyleElement[] = (window as any)[insertedStyleKey] ?? [];
  const inserted: Record<string, boolean> = {};
  styles.forEach((style) => {
    if (!inserted[style.innerText]) {
      inserted[style.innerText] = true;
      target.appendChild(style.cloneNode(true));
    }
  });
};
