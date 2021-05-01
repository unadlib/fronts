export type NodeElement = HTMLElement | null;

export type Render = (target: NodeElement) => () => void;

export type DynamicImport = () => Promise<{
  default: Render;
}>;

export interface CacheContainer {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}

export type UseApp = (
  dynamicImport: DynamicImport,
  options: {
    target: NodeElement;
  }
) => Promise<void | (() => void)>;

export type UseIFrame = (
  siteName: string,
  options: {
    [K: string]: any; // TODO: fix type with iframe Attributes
    target: NodeElement;
  }
) => void;

export type UseWebComponents = (
  dynamicImport: DynamicImport,
  options: UseWebComponentsOptions
) => Promise<void | (() => void)>;

export interface UseWebComponentsOptions {
  useShadowDOM?: boolean;
  shadowMode?: 'open' | 'closed';
  target: NodeElement;
}

export type DefineCustomElementOptions = Pick<
  UseWebComponentsOptions,
  Exclude<keyof UseWebComponentsOptions, 'target'>
>;
