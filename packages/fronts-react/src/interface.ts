/* eslint-disable @typescript-eslint/ban-types */
import { FunctionComponent, ReactElement } from 'react';
import {
  UseIframeOptions,
  UseWebComponentsOptions,
  UseAppOptions,
} from 'fronts';

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

export type UseApp = <T = {}, P = {}>(
  options: Pick<
    UseAppOptions<T, P>,
    Exclude<keyof UseAppOptions<T, P>, 'target'>
  >
) => AppWrapper<{}>;

export type UseWebComponents = <
  T extends Record<string, any> = Record<string, any>
>(
  options: Pick<
    UseWebComponentsOptions,
    Exclude<keyof UseWebComponentsOptions, 'target'>
  >
) => AppWrapper<{}>;

export type UseIframe = <T = {}>(
  options: Pick<
    UseIframeOptions<T>,
    Exclude<keyof UseIframeOptions<T>, 'target'>
  >
) => FunctionComponent;
