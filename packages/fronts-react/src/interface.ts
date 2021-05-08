import { FunctionComponent, ReactElement } from 'react';
import { UseIframeOptions, UseWebComponentsOptions, UseAppOptions } from 'fronts';

export type AppWrapper<T> = FunctionComponent<
  {
    fallback?: ReactElement<any, any> | null;
  } & T
>;

export type IframeWrapper<T> = FunctionComponent<
  {
    src?: string;
  } & T
>;

export type UseApp = <T extends Record<string, any> = Record<string, any>>(
  options: Pick<UseAppOptions, Exclude<keyof UseAppOptions, 'target'>>
) => AppWrapper<T>;

export type UseIframe = <T extends Record<string, any> = Record<string, any>>(
  options: Pick<UseIframeOptions, Exclude<keyof UseIframeOptions, 'target'>>
) => FunctionComponent<T>;

export type UseWebComponents = <
  T extends Record<string, any> = Record<string, any>
>(
  options: Pick<
    UseWebComponentsOptions,
    Exclude<keyof UseWebComponentsOptions, 'target'>
  >
) => AppWrapper<T>;
