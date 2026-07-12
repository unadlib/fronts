import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react';

import type {
  AppRef,
  BuiltInContainerRequest,
  ContainerRequest,
  ContainerRequestResolver,
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
  readonly error: Error | null;
  readonly instance: MountedApplication<Props, Source> | null;
  readonly status: RemoteAppStatus;
  readonly targetRef: RefCallback<HTMLDivElement>;
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
  options: UseRemoteAppOptions<Props, Source, Services, Request>,
): UseRemoteAppResult<Props, Source> {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<RemoteAppStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [instance, setInstance] = useState<MountedApplication<Props, Source> | null>(null);
  const instanceRef = useRef<MountedApplication<Props, Source> | null>(null);
  const lastProps = useRef<Props>(options.appProps);
  const updateVersion = useRef(0);
  const teardown = useRef<Promise<void>>(Promise.resolve());
  const onError = useRef(options.onError);
  const onReady = useRef(options.onReady);
  onError.current = options.onError;
  onReady.current = options.onReady;

  const targetRef = useCallback<RefCallback<HTMLDivElement>>((node) => setTarget(node), []);

  useEffect(() => {
    if (target === null) {
      setStatus('idle');
      setError(null);
      setInstance(null);
      return;
    }
    let disposed = false;
    const controller = new AbortController();
    setStatus('mounting');
    setError(null);
    setInstance(null);
    instanceRef.current = null;
    updateVersion.current += 1;

    const previousTeardown = teardown.current;
    const mount = previousTeardown
      .catch(() => undefined)
      .then(() => {
        if (disposed) {
          return null;
        }
        return options.host.mount<Props, Request>({
          ref: options.app,
          target,
          props: options.appProps,
          signal: controller.signal,
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
        instanceRef.current = mounted;
        lastProps.current = options.appProps;
        setInstance(mounted);
        setStatus('ready');
        notify(onReady.current, mounted);
      },
      (reason: unknown) => {
        if (disposed) {
          return;
        }
        const failure = toError(reason);
        setError(failure);
        setStatus('error');
        notify(onError.current, failure);
      },
    );

    return () => {
      disposed = true;
      updateVersion.current += 1;
      controller.abort('RemoteApp effect disposed');
      const mounted = instanceRef.current;
      instanceRef.current = null;
      teardown.current = mount
        .then(async (resolved) => {
          await (resolved ?? mounted)?.unmount();
        })
        .catch(() => undefined);
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
    options.traceId,
  ]);

  useEffect(() => {
    if (
      instance === null ||
      instanceRef.current !== instance ||
      Object.is(lastProps.current, options.appProps)
    ) {
      return;
    }
    lastProps.current = options.appProps;
    const version = ++updateVersion.current;
    void instance.update(options.appProps).then(
      () => {
        if (instanceRef.current !== instance || updateVersion.current !== version) {
          return;
        }
        setError(null);
        setStatus('ready');
      },
      (reason: unknown) => {
        if (instanceRef.current !== instance || updateVersion.current !== version) {
          return;
        }
        const failure = toError(reason);
        setError(failure);
        setStatus('error');
        notify(onError.current, failure);
      },
    );
  }, [instance, options.appProps]);

  return { error, instance, status, targetRef };
}
