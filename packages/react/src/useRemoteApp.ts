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

import { nestedShallowEqual, shallowEqual } from './equality.js';

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
   * Decides whether a render carries new application props. Defaults to a shallow comparison so a
   * re-rendered prop object with unchanged values does not call `update()`.
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
  readonly error: Error | null;
  readonly instance: MountedApplication<Props, Source> | null;
  /**
   * Abandons the current application instance and starts a new mount attempt with a new operation
   * identity. It never resumes a partially failed mount.
   */
  readonly retry: () => void;
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

/**
 * Retains the previously seen value while an incoming one is still equal to it, so a mount input
 * re-created by an ordinary render does not read as a new deployment request.
 */
function useStableValue<Value>(
  value: Value,
  equals: (previous: Value, next: Value) => boolean,
): Value {
  const stored = useRef(value);
  if (!equals(stored.current, value)) {
    stored.current = value;
  }
  return stored.current;
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

  const container = useStableValue(options.container, nestedShallowEqual);
  const resolve = useStableValue(options.resolve, nestedShallowEqual);
  const [attempt, setAttempt] = useState(0);

  const targetRef = useCallback<RefCallback<HTMLDivElement>>((node) => setTarget(node), []);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

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
          ...(container === undefined ? {} : { container }),
          ...(options.instanceId === undefined ? {} : { instanceId: options.instanceId }),
          ...(options.readyTimeoutMs === undefined
            ? {}
            : { readyTimeoutMs: options.readyTimeoutMs }),
          ...(resolve === undefined ? {} : { resolve }),
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
    attempt,
    target,
    options.host,
    options.app.name,
    options.app.expose,
    options.app.range,
    options.app.channel,
    container,
    options.instanceId,
    options.mountKey,
    options.readyTimeoutMs,
    resolve,
    options.traceId,
  ]);

  useEffect(() => {
    if (
      instance === null ||
      instanceRef.current !== instance ||
      (options.arePropsEqual ?? shallowEqual)(lastProps.current, options.appProps)
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

  return { error, instance, retry, status, targetRef };
}
