export const unmount = (target: HTMLElement, name: string) => {
  const key = `__${name}__`;
  (window as any)[key] ??= {};
  const appConfig: {
    insertedStyleElements?: HTMLStyleElement[];
    insertedStyleTargets?: HTMLElement[];
  } = (window as any)[key];
  appConfig.insertedStyleTargets?.splice(
    appConfig.insertedStyleTargets?.findIndex((element) => element === target),
    1
  );
};
