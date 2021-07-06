import {
  UseIframeOptions,
  UseWebComponentsOptions,
  UseAppOptions,
} from 'fronts';

export type UseApp = <T = {}, P = {}>(
  options: Pick<
    UseAppOptions<T, P>,
    Exclude<keyof UseAppOptions<T, P>, 'target'>
  >
) => any;

export type UseWebComponents = <
  T extends Record<string, any> = Record<string, any>
>(
  options: Pick<
    UseWebComponentsOptions,
    Exclude<keyof UseWebComponentsOptions, 'target'>
  >
) => any;

export type UseIframe = <T = {}>(
  options: Pick<
    UseIframeOptions<T>,
    Exclude<keyof UseIframeOptions<T>, 'target'>
  >
) => any;
