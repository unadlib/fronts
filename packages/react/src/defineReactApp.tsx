import {
  Fragment,
  StrictMode,
  createElement,
  useLayoutEffect,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { createRoot, type Root, type RootOptions } from 'react-dom/client';

import {
  FrontsError,
  defineApp,
  frontsErrorCodes,
  type ApplicationIdentity,
  type FrontsApp,
  type ServiceKey,
} from '@fronts/core';

import { FrontsReactContext, type FrontsReactContextValue } from './context.js';
import { ReactAppErrorBoundary } from './errorBoundary.js';

export interface ReactAppRenderContext<
  Props extends object,
  Services extends object,
> extends FrontsReactContextValue<Services> {
  readonly props: Readonly<Props>;
  readonly Root: ComponentType<Props>;
}

export interface DefineReactAppOptions<Props extends object, Services extends object> {
  readonly root: ComponentType<Props>;
  readonly name?: string;
  readonly capabilities?: readonly ServiceKey<Services>[];
  readonly strictMode?: boolean;
  readonly fallback?: ReactNode | ((error: Error) => ReactNode);
  readonly rootOptions?: RootOptions;
  readonly createRoot?: (target: Element | DocumentFragment, options?: RootOptions) => Root;
  readonly render?: (context: ReactAppRenderContext<Props, Services>) => ReactNode;
  readonly onError?: (error: Error, info: ErrorInfo) => void;
  readonly onActivate?: (identity: ApplicationIdentity) => void | PromiseLike<void>;
  readonly onDeactivate?: (identity: ApplicationIdentity) => void | PromiseLike<void>;
}

interface Deferred {
  readonly promise: Promise<void>;
  readonly reject: (reason: unknown) => void;
  readonly resolve: () => void;
}

function createDeferred(): Deferred {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function CommitSignal({ commit }: { readonly commit: () => void }): null {
  useLayoutEffect(commit, [commit]);
  return null;
}

export function defineReactApp<
  Props extends object = Record<string, never>,
  Services extends object = object,
>(options: DefineReactAppOptions<Props, Services>): FrontsApp<Props, Services> {
  return defineApp<Props, Services>({
    ...(options.name === undefined ? {} : { name: options.name }),
    ...(options.capabilities === undefined ? {} : { capabilities: options.capabilities }),
    mount(context) {
      let disposed = false;
      let pending: Deferred | undefined;
      const rootFactory = options.createRoot ?? createRoot;
      const root = rootFactory(context.target, options.rootOptions);
      const reactContext: FrontsReactContextValue<Services> = {
        identity: context.identity,
        services: context.services,
        signal: context.signal,
      };

      const render = (props: Readonly<Props>): Promise<void> => {
        if (disposed) {
          return Promise.reject(
            new FrontsError(
              frontsErrorCodes.invalidState,
              `React application "${context.identity.name}" has been unmounted.`,
              { phase: 'update' },
            ),
          );
        }
        const deferred = createDeferred();
        pending?.reject(
          new FrontsError(
            frontsErrorCodes.aborted,
            'A newer React application render superseded this render.',
            { phase: 'update' },
          ),
        );
        pending = deferred;

        const renderContext: ReactAppRenderContext<Props, Services> = {
          ...reactContext,
          props,
          Root: options.root,
        };
        const application =
          options.render?.(renderContext) ?? createElement(options.root, props as Props);
        const content = createElement(
          ReactAppErrorBoundary,
          {
            ...(options.fallback === undefined ? {} : { fallback: options.fallback }),
            onError(error, info) {
              options.onError?.(error, info);
              if (pending === deferred) {
                pending = undefined;
                deferred.reject(error);
              }
            },
          },
          createElement(
            Fragment,
            null,
            application,
            createElement(CommitSignal, {
              commit() {
                if (pending === deferred) {
                  pending = undefined;
                  deferred.resolve();
                }
              },
            }),
          ),
        );
        root.render(
          createElement(
            FrontsReactContext.Provider,
            { value: reactContext },
            options.strictMode === true ? createElement(StrictMode, null, content) : content,
          ),
        );
        return deferred.promise;
      };

      const ready = render(context.props);
      return {
        ready,
        activate: () => options.onActivate?.(context.identity),
        deactivate: () => options.onDeactivate?.(context.identity),
        update: render,
        unmount() {
          if (disposed) {
            return;
          }
          disposed = true;
          pending?.reject(
            new FrontsError(
              frontsErrorCodes.aborted,
              `React application "${context.identity.name}" unmounted before rendering completed.`,
              { phase: 'unmount' },
            ),
          );
          pending = undefined;
          root.unmount();
        },
      };
    },
  });
}
