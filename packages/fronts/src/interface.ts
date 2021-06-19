/* eslint-disable @typescript-eslint/ban-types */
export type NodeElement = HTMLElement | null;

export type Render<P = {}> = (target: NodeElement, props?: P) => () => void;

export type DynamicImport<T = {}> = (
  name: string
) => Promise<{
  default: Render<T>;
}>;

export type RegistryResponse = Record<string, string>;

export interface CacheContainer {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}

export interface UseAppOptions<T = {}, P = {}> {
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
  /**
   *
   */
  attrs?: T;
  /**
   *
   */
  props?: P;
}

export interface UseIframeOptions<T = {}> {
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
  url?: string;
  /**
   *
   */
  attrs?: T;
}

export interface UseWebComponentsOptions<T = {}, P = {}> {
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
  /**
   *
   */
  retargetEvent?: boolean;
  /**
   *
   */
  attrs?: T;
  /**
   *
   */
  props?: P;
}

export type UseApp = <T = {}, P = {}>(
  options: UseAppOptions<T, P>
) => Promise<void | (() => void)>;

export type UseWebComponents = <T = {}, P = {}>(
  options: UseWebComponentsOptions<T, P>
) => Promise<void | (() => void)>;

export type UseIframe = <T = {}>(options: UseIframeOptions<T>) => void;

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
