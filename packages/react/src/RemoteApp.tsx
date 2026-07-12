import type { HTMLAttributes, ReactNode } from 'react';

import type { BuiltInContainerRequest, ContainerRequest, FrontsHost } from '@fronts/core';

import { useRemoteApp, type UseRemoteAppOptions, type UseRemoteAppResult } from './useRemoteApp.js';

export interface RemoteAppProps<
  Props,
  Source,
  Services extends object,
  Request extends ContainerRequest = BuiltInContainerRequest,
> extends UseRemoteAppOptions<Props, Source, Services, Request> {
  readonly fallback?: ReactNode | ((error: Error) => ReactNode);
  readonly loading?: ReactNode;
  readonly targetProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'ref'>;
  readonly wrapperProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children'>;
}

export function RemoteApp<
  Props,
  Source,
  Services extends object,
  Request extends ContainerRequest = BuiltInContainerRequest,
>(props: RemoteAppProps<Props, Source, Services, Request>): ReactNode {
  const { fallback, loading, targetProps, wrapperProps, ...options } = props;
  const remote = useRemoteApp(options);
  const status =
    remote.status === 'error' && remote.error !== null
      ? typeof fallback === 'function'
        ? fallback(remote.error)
        : (fallback ?? null)
      : remote.status === 'mounting'
        ? (loading ?? null)
        : null;

  return (
    <div {...wrapperProps} data-fronts-react-status={remote.status}>
      <div {...targetProps} ref={remote.targetRef} data-fronts-react-target="" />
      {status}
    </div>
  );
}

export type ReactFrontsHost<Source, Services extends object> = FrontsHost<Source, Services>;
export type RemoteAppHookResult<Props, Source> = UseRemoteAppResult<Props, Source>;
