declare const __DEV__: boolean;
declare const __webpack_init_sharing__: (name: string) => Promise<void>;
declare const __webpack_share_scopes__: Record<string, string>;

interface Window {
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
  __FRONTS__DYNAMIC__IMPORT__: boolean;
  __FRONTS__DYNAMIC__MODULES__: Record<
    string,
    {
      default: (target: HTMLElement | null) => () => void;
    }
  >;
  __FRONTS__FETCH__MODULES__: Record<string, Set<() => void>>;
}
