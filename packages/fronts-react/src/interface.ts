import { UseWebComponentsOptions } from 'fronts';
import { DynamicImport } from 'fronts';
import { FunctionComponent, ReactElement } from 'react';

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
  dynamicImport: DynamicImport,
  options?: {
    name?: string;
  }
) => AppWrapper<T>;

export type UseIFrame = <T extends Record<string, any> = Record<string, any>>(
  siteName: string
) => FunctionComponent<T>;

export type UseWebComponents = <
  T extends Record<string, any> = Record<string, any>
>(
  dynamicImport: DynamicImport,
  options?: Pick<
    UseWebComponentsOptions,
    Exclude<keyof UseWebComponentsOptions, 'target'>
  >
) => AppWrapper<T>;
