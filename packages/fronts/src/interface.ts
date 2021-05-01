export type NodeElement = HTMLElement | null;

export type Render = (target: NodeElement) => () => void;

export type DynamicImport = () => Promise<{
  default: Render;
}>;

export interface CacheContainer {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}

export interface WebComponentsOptions {
  useShadowDOM?: boolean;
  shadowMode?: 'open' | 'closed';
  target: NodeElement;
}

export type DefineCustomElementOptions = Pick<
  WebComponentsOptions,
  Exclude<keyof WebComponentsOptions, 'target'>
>;
