import {
  createApp,
  defineComponent,
  h,
  nextTick,
  shallowReactive,
  type App,
  type Component,
} from 'vue';

import {
  FrontsError,
  defineApp,
  frontsErrorCodes,
  throwIfAborted,
  type ApplicationIdentity,
  type FrontsApp,
  type ServiceKey,
} from '@fronts/core';

import { FrontsVueContextKey, type FrontsVueContextValue } from './context.js';

export interface VueAppConfigureContext<
  Props extends object,
  Services extends object,
> extends FrontsVueContextValue<Services> {
  readonly props: Readonly<Props>;
}

export interface DefineVueAppOptions<Props extends object, Services extends object> {
  readonly root: Component;
  readonly name?: string;
  readonly capabilities?: readonly ServiceKey<Services>[];
  readonly createApp?: typeof createApp;
  readonly configure?: (
    app: App,
    context: VueAppConfigureContext<Props, Services>,
  ) => void | PromiseLike<void>;
  readonly onError?: (error: unknown, info: string) => void;
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

export function defineVueApp<
  Props extends object = Record<string, never>,
  Services extends object = object,
>(options: DefineVueAppOptions<Props, Services>): FrontsApp<Props, Services> {
  return defineApp<Props, Services>({
    ...(options.name === undefined ? {} : { name: options.name }),
    ...(options.capabilities === undefined ? {} : { capabilities: options.capabilities }),
    async mount(context) {
      const props = shallowReactive(Object.assign(Object.create(null), context.props)) as Props;
      const Root = defineComponent({
        name: 'FrontsVueRoot',
        setup: () => () => h(options.root, props),
      });
      const vueContext: FrontsVueContextValue<Services> = {
        identity: context.identity,
        services: context.services,
        signal: context.signal,
      };
      const app = (options.createApp ?? createApp)(Root);
      app.provide(FrontsVueContextKey, vueContext);
      const mountTarget =
        context.target instanceof ShadowRoot
          ? context.target.ownerDocument.createElement('div')
          : context.target;
      if (context.target instanceof ShadowRoot) {
        try {
          context.target.append(mountTarget);
        } catch (error) {
          mountTarget.remove();
          throw error;
        }
      }
      let disposed = false;
      let pending: Deferred | undefined;

      try {
        await options.configure?.(app, { ...vueContext, props: context.props });
        throwIfAborted(context.signal, 'mount');
      } catch (error) {
        if (mountTarget !== context.target) {
          mountTarget.remove();
        }
        throw error;
      }
      const configuredErrorHandler = app.config.errorHandler;
      app.config.errorHandler = (error, instance, info) => {
        const failed = pending;
        if (failed !== undefined) {
          pending = undefined;
          failed.reject(error);
        }
        try {
          configuredErrorHandler?.(error, instance, info);
        } catch {
          // Configured error observers must not replace the application render failure.
        }
        try {
          options.onError?.(error, info);
        } catch {
          // Observer failures must not replace the application render failure.
        }
      };

      const waitForRender = (): Promise<void> => {
        const deferred = createDeferred();
        pending?.reject(
          new FrontsError(
            frontsErrorCodes.aborted,
            'A newer Vue application render superseded this render.',
            { phase: 'update' },
          ),
        );
        pending = deferred;
        void nextTick().then(() => {
          if (pending === deferred) {
            pending = undefined;
            deferred.resolve();
          }
        }, deferred.reject);
        return deferred.promise;
      };

      const ready = waitForRender();
      try {
        app.mount(mountTarget);
      } catch (error) {
        pending?.reject(error);
        pending = undefined;
        ready.catch(() => undefined);
        let cleanupError: unknown;
        try {
          app.unmount();
        } catch (unmountError) {
          cleanupError = unmountError;
        }
        if (mountTarget === context.target) {
          mountTarget.replaceChildren();
        } else {
          mountTarget.remove();
        }
        if (cleanupError !== undefined) {
          throw new FrontsError(
            frontsErrorCodes.mountFailed,
            `Vue application "${context.identity.name}" failed to mount and clean up.`,
            {
              cause: new AggregateError([error, cleanupError]),
              phase: 'mount',
            },
          );
        }
        throw error;
      }

      return {
        ready,
        activate: () => options.onActivate?.(context.identity),
        deactivate: () => options.onDeactivate?.(context.identity),
        async update(nextProps) {
          if (disposed) {
            throw new FrontsError(
              frontsErrorCodes.invalidState,
              `Vue application "${context.identity.name}" has been unmounted.`,
              { phase: 'update' },
            );
          }
          for (const key of Object.keys(props)) {
            if (!Object.prototype.hasOwnProperty.call(nextProps, key)) {
              Reflect.deleteProperty(props, key);
            }
          }
          Object.assign(props, nextProps);
          await waitForRender();
        },
        unmount() {
          if (disposed) {
            return;
          }
          disposed = true;
          pending?.reject(
            new FrontsError(
              frontsErrorCodes.aborted,
              `Vue application "${context.identity.name}" unmounted before rendering completed.`,
              { phase: 'unmount' },
            ),
          );
          pending = undefined;
          try {
            app.unmount();
          } finally {
            if (mountTarget !== context.target) {
              mountTarget.remove();
            }
          }
        },
      };
    },
  });
}
