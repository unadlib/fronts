import { FunctionComponent, ReactElement } from 'react';
import { UseIFrameOptions, UseWebComponentsOptions, UseAppOptions } from 'fronts';

export type AppWrapper<T> = FunctionComponent<
  {
    fallback?: ReactElement<any, any> | null;
  } & T
>;

export type IFrameWrapper<T> = FunctionComponent<
  {
    src?: string;
  } & T
>;

export type UseApp = <T extends Record<string, any> = Record<string, any>>(
  options: Pick<UseAppOptions, Exclude<keyof UseAppOptions, 'target'>>
) => AppWrapper<T>;

export type UseIFrame = <T extends Record<string, any> = Record<string, any>>(
  options: Pick<UseIFrameOptions, Exclude<keyof UseIFrameOptions, 'target'>>
) => FunctionComponent<T>;

export type UseWebComponents = <
  T extends Record<string, any> = Record<string, any>
>(
  options: Pick<
    UseWebComponentsOptions,
    Exclude<keyof UseWebComponentsOptions, 'target'>
  >
) => AppWrapper<T>;
