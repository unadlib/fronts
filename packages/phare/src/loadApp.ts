type NodeElement = HTMLElement | null;

type DynamicImport = () => Promise<{
  default: (target: NodeElement) => (() => void) | void;
}>;

export const loadApp = (dynamicImport: DynamicImport, target: NodeElement) => {
  (window as any).__APP__ = true;
  return dynamicImport().then((module) => {
    return module.default(target);
  });
};
