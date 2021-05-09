import { InsertedStyle } from './interface';

export const unmount = (currentTarget: HTMLElement, name: string) => {
  const key = `__${name}__`;
  (window as any)[key] ??= {};
  const insertedStyle: InsertedStyle = (window as any)[key];
  insertedStyle.targets?.splice(
    insertedStyle.targets?.findIndex((target) => target === currentTarget),
    1
  );
};
