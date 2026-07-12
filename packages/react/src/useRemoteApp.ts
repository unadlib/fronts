import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react';

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
  readonly error: Error | null;
  readonly instance: MountedApplication<Props, Source> | null;
  readonly status: RemoteAppStatus;
  readonly targetRef: RefCallback<HTMLDivElement>;
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
  options: UseRemoteAppOptions<Props, Source, Services, Request>,
): UseRemoteAppResult<Props, Source> {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<RemoteAppStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [instance, setInstance] = useState<MountedApplication<Props, Source> | null>(null);
  const instanceRef = useRef<MountedApplication<Props, Source> | null>(null);
  const lastProps = useRef<Props>(options.appProps);
  const onError = useRef(options.onError);
  const onReady = useRef(options.onReady);
  onError.current = options.onError;
  onReady.current = options.onReady;

  const targetRef = useCallback<RefCallback<HTMLDivElement>>((node) => setTarget(node), []);

  useEffect(() => {
    if (target === null) {
      return;
    }
    let disposed = false;
    const controller = new AbortController();
    setStatus('mounting');
    setError(null);
    setInstance(null);
    instanceRef.current = null;

    const mount = options.host.mount<Props, Request>({
      ref: options.app,
      target,
      props: options.appProps,
      signal: controller.signal,
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
        instanceRef.current = mounted;
        lastProps.current = options.appProps;
        setInstance(mounted);
        setStatus('ready');
        onReady.current?.(mounted);
      },
      (reason: unknown) => {
        if (disposed) {
          return;
        }
        const failure = toError(reason);
        setError(failure);
        setStatus('error');
        onError.current?.(failure);
      },
    );

    return () => {
      disposed = true;
      controller.abort('RemoteApp effect disposed');
      const mounted = instanceRef.current;
      instanceRef.current = null;
      if (mounted !== null) {
        void mounted.unmount().catch(() => undefined);
      }
    };
  }, [
    target,
    options.host,
    options.app.name,
    options.app.expose,
    options.app.range,
    options.app.channel,
    options.container,
    options.instanceId,
    options.mountKey,
    options.readyTimeoutMs,
    options.resolve,
  ]);

  useEffect(() => {
    if (instance === null || Object.is(lastProps.current, options.appProps)) {
      return;
    }
    lastProps.current = options.appProps;
    void instance.update(options.appProps).catch((reason: unknown) => {
      const failure = toError(reason);
      setError(failure);
      setStatus('error');
      onError.current?.(failure);
    });
  }, [instance, options.appProps]);

  return { error, instance, status, targetRef };
}
