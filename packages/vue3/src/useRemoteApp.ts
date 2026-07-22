import { shallowRef, toValue, watch, type MaybeRefOrGetter, type ShallowRef } from 'vue';

import type {
  AppRef,
  BuiltInContainerRequest,
  ContainerRequest,
  ContainerRequestResolver,
  FrontsHost,
  MountResolveOptions,
  MountedApplication,
} from '@fronts/core';

import { shallowEqual } from './equality.js';

export type RemoteAppStatus = 'idle' | 'mounting' | 'ready' | 'error';

export interface UseRemoteAppOptions<
  Props,
  Source,
  Services extends object,
  Request extends ContainerRequest = BuiltInContainerRequest,
> {
  readonly host: FrontsHost<Source, Services>;
  readonly app: AppRef;
  readonly appProps: Props;
  /**
   * Decides whether a newly supplied prop object carries new values. Defaults to a shallow
   * comparison. It is consulted only when the object identity changed; an in-place mutation of a
   * reactive prop object always updates the application.
   */
  readonly arePropsEqual?: (previous: Props, next: Props) => boolean;
  readonly container?: Request | ContainerRequestResolver<Source, Request>;
  readonly instanceId?: string;
  readonly mountKey?: string | number;
  readonly readyTimeoutMs?: number;
  readonly resolve?: MountResolveOptions;
  readonly traceId?: string;
  readonly onError?: (error: Error) => void;
  readonly onReady?: (instance: MountedApplication<Props, Source>) => void;
}

export interface UseRemoteAppResult<Props, Source> {
  readonly error: ShallowRef<Error | null>;
  readonly instance: ShallowRef<MountedApplication<Props, Source> | null>;
  readonly status: ShallowRef<RemoteAppStatus>;
  readonly target: ShallowRef<HTMLDivElement | null>;
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  try {
    return new Error(String(error));
  } catch {
    return new Error('The remote application failed with an unknown error.');
  }
}

function notify<Arguments extends readonly unknown[]>(
  listener: ((...arguments_: Arguments) => void) | undefined,
  ...arguments_: Arguments
): void {
  try {
    listener?.(...arguments_);
  } catch {
    // Observer failures do not change the remote application lifecycle.
  }
}

export function useRemoteApp<
  Props,
  Source,
  Services extends object,
  Request extends ContainerRequest = BuiltInContainerRequest,
>(
  input: MaybeRefOrGetter<UseRemoteAppOptions<Props, Source, Services, Request>>,
): UseRemoteAppResult<Props, Source> {
  const target = shallowRef<HTMLDivElement | null>(null);
  const status = shallowRef<RemoteAppStatus>('idle');
  const error = shallowRef<Error | null>(null);
  const instance = shallowRef<MountedApplication<Props, Source> | null>(null);
  let propsVersion = 0;
  let appliedPropsVersion = 0;
  let appliedProps: Props | undefined;
  let hasAppliedProps = false;
  let teardown: Promise<void> = Promise.resolve();

  const updateMounted = (
    mounted: MountedApplication<Props, Source>,
    nextProps: Props,
    version: number,
  ): void => {
    if (version <= appliedPropsVersion) {
      return;
    }
    appliedPropsVersion = version;
    void mounted.update(nextProps).then(
      () => {
        if (instance.value !== mounted || appliedPropsVersion !== version) {
          return;
        }
        error.value = null;
        status.value = 'ready';
      },
      (reason: unknown) => {
        if (instance.value !== mounted || appliedPropsVersion !== version) {
          return;
        }
        const failure = toError(reason);
        error.value = failure;
        status.value = 'error';
        notify(toValue(input).onError, failure);
      },
    );
  };

  watch(
    [
      () => target.value,
      () => toValue(input).host,
      () => toValue(input).app.name,
      () => toValue(input).app.expose,
      () => toValue(input).app.range,
      () => toValue(input).app.channel,
      () => toValue(input).container,
      () => toValue(input).instanceId,
      () => toValue(input).mountKey,
      () => toValue(input).readyTimeoutMs,
      () => toValue(input).resolve,
      () => toValue(input).traceId,
    ],
    (_values, _previous, onCleanup) => {
      const element = target.value;
      if (element === null) {
        status.value = 'idle';
        error.value = null;
        instance.value = null;
        return;
      }
      const options = toValue(input);
      const mountedPropsVersion = propsVersion;
      appliedProps = options.appProps;
      hasAppliedProps = true;
      const controller = new AbortController();
      let current: MountedApplication<Props, Source> | null = null;
      let disposed = false;
      status.value = 'mounting';
      error.value = null;
      instance.value = null;

      const previousTeardown = teardown;
      const mount = previousTeardown
        .catch(() => undefined)
        .then(() => {
          if (disposed) {
            return null;
          }
          return options.host.mount<Props, Request>({
            props: options.appProps,
            ref: options.app,
            signal: controller.signal,
            target: element,
            ...(options.container === undefined ? {} : { container: options.container }),
            ...(options.instanceId === undefined ? {} : { instanceId: options.instanceId }),
            ...(options.readyTimeoutMs === undefined
              ? {}
              : { readyTimeoutMs: options.readyTimeoutMs }),
            ...(options.resolve === undefined ? {} : { resolve: options.resolve }),
            ...(options.traceId === undefined ? {} : { traceId: options.traceId }),
          });
        });

      void mount.then(
        (mounted) => {
          if (mounted === null || disposed) {
            return;
          }
          current = mounted;
          appliedPropsVersion = mountedPropsVersion;
          instance.value = mounted;
          status.value = 'ready';
          notify(toValue(input).onReady, mounted);
          updateMounted(mounted, toValue(input).appProps, propsVersion);
        },
        (reason: unknown) => {
          if (disposed) {
            return;
          }
          const failure = toError(reason);
          error.value = failure;
          status.value = 'error';
          notify(toValue(input).onError, failure);
        },
      );

      onCleanup(() => {
        disposed = true;
        controller.abort('Vue remote application watcher disposed');
        const mounted = current;
        current = null;
        if (instance.value === mounted) {
          instance.value = null;
        }
        teardown = mount
          .then(async (resolved) => {
            await (resolved ?? mounted)?.unmount();
          })
          .catch(() => undefined);
      });
    },
    { flush: 'post', immediate: true },
  );

  watch(
    () => toValue(input).appProps,
    (nextProps) => {
      // A deep watcher also fires for an in-place mutation of a reactive prop object. That case
      // keeps the same identity, so equality must only suppress a genuinely re-created object.
      if (
        hasAppliedProps &&
        !Object.is(appliedProps, nextProps) &&
        (toValue(input).arePropsEqual ?? shallowEqual)(appliedProps as Props, nextProps)
      ) {
        return;
      }
      appliedProps = nextProps;
      hasAppliedProps = true;
      propsVersion += 1;
      const mounted = instance.value;
      if (mounted === null) {
        return;
      }
      updateMounted(mounted, nextProps, propsVersion);
    },
    { deep: true, flush: 'post' },
  );

  return { error, instance, status, target };
}
