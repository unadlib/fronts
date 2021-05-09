export type NodeElement = HTMLElement | null;

export type Render = (target: NodeElement) => () => void;

export type DynamicImport = (
  name: string
) => Promise<{
  default: Render;
}>;

export interface CacheContainer {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}

export interface UseAppOptions {
  /**
   *
   */
  name: string;
  /**
   *
   */
  target: HTMLElement;
  /**
   *
   */
  loader: DynamicImport;
}

export interface UseIframeOptions {
  /**
   *
   */
  name: string;
  /**
   *
   */
  target: HTMLElement;
}

export interface UseWebComponentsOptions {
  /**
   *
   */
  name: string;
  /**
   *
   */
  target: HTMLElement;
  /**
   *
   */
  useShadowDOM?: boolean;
  /**
   *
   */
  shadowMode?: 'open' | 'closed';
  /**
   *
   */
  loader: DynamicImport;
}

export type UseApp = (options: UseAppOptions) => Promise<void | (() => void)>;

export type UseIframe = (options: UseIframeOptions) => void; // TODO: fix type with iframe Attributes

export type UseWebComponents = (
  options: UseWebComponentsOptions
) => Promise<void | (() => void)>;

export type DefineCustomElementOptions = Pick<
  UseWebComponentsOptions,
  Exclude<keyof UseWebComponentsOptions, 'target' | 'loader'>
>;

export interface InsertedStyle {
  /**
   *
   */
  elements?: (HTMLStyleElement | HTMLLinkElement)[];
  /**
   *
   */
  targets?: HTMLElement[];
}
