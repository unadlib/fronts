declare const __DEV__: boolean;
declare const __webpack_init_sharing__: (name: string) => Promise<void>;
declare const __webpack_share_scopes__: Record<string, string>;

interface Window {
  /**
   * Fronts app's meta data
   */
  __FRONTS__: Record<
    string,
    {
      dependencies: Record<string, string>;
      registry?: string;
      version?: string;
    }
  > & {
    __main__: string;
    __entry__: string;
  };
  /**
   * Use `Standalone` app
   */
  __FRONTS__DYNAMIC__IMPORT__: boolean;
  /**
   * App bootstrap collection for non-module-federation
   */
  __FRONTS__DYNAMIC__MODULES__: Record<
    string,
    {
      default: (target: HTMLElement | null) => () => void;
    }
  >;
  /**
   * Handlers for loading script listener for non-module-federation
   */
  __FRONTS__FETCH__MODULES__: Record<string, Set<() => void>>;
}

declare namespace JSX {
  interface IntrinsicElements {
    'fronts-app': any;
  }
}
