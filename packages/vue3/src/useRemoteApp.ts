import { shallowRef, toValue, watch, type MaybeRefOrGetter, type ShallowRef } from 'vue';

import type {
  AppRef,
  BuiltInContainerRequest,
  ContainerRequest,
  FrontsHost,
  MountResolveOptions,
  MountedApplication,
} from '@fronts/core';

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
  readonly container?: Request;
  readonly instanceId?: string;
  readonly mountKey?: string | number;
  readonly readyTimeoutMs?: number;
  readonly resolve?: MountResolveOptions;
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
  return error instanceof Error ? error : new Error(String(error));
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

  const updateMounted = (
    mounted: MountedApplication<Props, Source>,
    nextProps: Props,
    version: number,
  ): void => {
    if (version <= appliedPropsVersion) {
      return;
    }
    appliedPropsVersion = version;
    void mounted.update(nextProps).catch((reason: unknown) => {
      const failure = toError(reason);
      error.value = failure;
      status.value = 'error';
      toValue(input).onError?.(failure);
    });
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
    ],
    (_values, _previous, onCleanup) => {
      const element = target.value;
      if (element === null) {
        return;
      }
      const options = toValue(input);
      const mountedPropsVersion = propsVersion;
      const controller = new AbortController();
      let current: MountedApplication<Props, Source> | null = null;
      let disposed = false;
      status.value = 'mounting';
      error.value = null;
      instance.value = null;

      const mount = options.host.mount<Props, Request>({
        props: options.appProps,
        ref: options.app,
        signal: controller.signal,
        target: element,
        ...(options.container === undefined ? {} : { container: options.container }),
        ...(options.instanceId === undefined ? {} : { instanceId: options.instanceId }),
        ...(options.readyTimeoutMs === undefined ? {} : { readyTimeoutMs: options.readyTimeoutMs }),
        ...(options.resolve === undefined ? {} : { resolve: options.resolve }),
      });

      void mount.then(
        (mounted) => {
          if (disposed) {
            void mounted.unmount().catch(() => undefined);
            return;
          }
          current = mounted;
          appliedPropsVersion = mountedPropsVersion;
          instance.value = mounted;
          status.value = 'ready';
          toValue(input).onReady?.(mounted);
          updateMounted(mounted, toValue(input).appProps, propsVersion);
        },
        (reason: unknown) => {
          if (disposed) {
            return;
          }
          const failure = toError(reason);
          error.value = failure;
          status.value = 'error';
          toValue(input).onError?.(failure);
        },
      );

      onCleanup(() => {
        disposed = true;
        controller.abort('Vue remote application watcher disposed');
        const mounted = current;
        current = null;
        if (mounted !== null) {
          void mounted.unmount().catch(() => undefined);
        }
      });
    },
    { flush: 'post', immediate: true },
  );

  watch(
    () => toValue(input).appProps,
    (nextProps) => {
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
