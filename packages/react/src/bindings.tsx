import type { ComponentType, HTMLAttributes, ReactElement, ReactNode } from 'react';

import {
  FrontsError,
  frontsErrorCodes,
  type AppRef,
  type ApplicationContractShape,
  type ApplicationName,
  type BuiltInContainerRequest,
  type ContainerRequest,
  type ContainerRequestResolver,
  type HostComposition,
  type MountedApplication,
  type ResolutionPolicyContext,
} from '@fronts/core';

import { RemoteApp, type RemoteFailure } from './RemoteApp.js';

export interface Selection {
  /** AppRef fields; these participate in instance identity and audit output. */
  readonly ref?: Pick<AppRef, 'range' | 'channel'>;
  /** Resolver policy input; these fields do not enter instance identity. */
  readonly resolve?: ResolutionPolicyContext;
}

export type ContainerOption<Source, Request extends ContainerRequest = BuiltInContainerRequest> =
  'dom' | 'shadow' | Request | ContainerRequestResolver<Source, Request>;

export interface AppControls<
  Props,
  Source,
  Request extends ContainerRequest = BuiltInContainerRequest,
> {
  readonly selection?: Selection;
  readonly container?: ContainerOption<Source, Request>;
  readonly instanceId?: string;
  readonly traceId?: string;
  readonly readyTimeoutMs?: number;
  readonly loading?: ReactNode;
  readonly fallback?: ReactNode | ((failure: RemoteFailure) => ReactNode);
  readonly arePropsEqual?: (previous: Props, next: Props) => boolean;
  readonly onReady?: (application: MountedApplication<Props, Source>) => void;
  readonly onError?: (error: Error) => void;
  readonly targetProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'ref'>;
  readonly wrapperProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children'>;
}

/** Distributed over application names so each name remains correlated with its props. */
export type BoundAppProps<
  Contracts extends ApplicationContractShape<Contracts>,
  Source,
  Request extends ContainerRequest = BuiltInContainerRequest,
> = {
  [Name in ApplicationName<Contracts>]: AppControls<Contracts[Name], Source, Request> & {
    readonly app: Name;
    readonly props: Contracts[Name];
  };
}[ApplicationName<Contracts>];

export type ReactAppComponent<Contracts extends ApplicationContractShape<Contracts>, Source> = <
  Request extends ContainerRequest = BuiltInContainerRequest,
>(
  props: BoundAppProps<Contracts, Source, Request>,
) => ReactElement | null;

export type ComponentDefaults<
  Props,
  Source,
  Request extends ContainerRequest = BuiltInContainerRequest,
> = Omit<AppControls<Props, Source, Request>, 'instanceId'>;

export interface PreloadOptions {
  readonly selection?: Selection;
  readonly traceId?: string;
}

export interface ReactBindings<Contracts extends ApplicationContractShape<Contracts>, Source> {
  /** Inline form for an application or control options that vary per render. */
  readonly App: ReactAppComponent<Contracts, Source>;

  /** Stable component factory whose public props are exactly the application props. */
  component<
    Name extends ApplicationName<Contracts>,
    Request extends ContainerRequest = BuiltInContainerRequest,
  >(
    name: Name,
    defaults?: ComponentDefaults<Contracts[Name], Source, Request>,
  ): ComponentType<Contracts[Name]>;

  /** Uses the same reference, resolver, and loader path as a later mount. */
  preload<Name extends ApplicationName<Contracts>>(
    app: Name,
    options?: PreloadOptions,
  ): Promise<void>;
}

const domContainer = Object.freeze({ type: 'dom' } as const);
const shadowContainer = Object.freeze({ mode: 'open', type: 'shadow' } as const);

function toContainer<Source>(
  container: ContainerOption<Source, ContainerRequest> | undefined,
): ContainerRequest | ContainerRequestResolver<Source, ContainerRequest> | undefined {
  if (container === 'dom') {
    return domContainer;
  }
  if (container === 'shadow') {
    return shadowContainer;
  }
  return container;
}

function createReference(
  applications: Readonly<Record<string, Readonly<AppRef> | undefined>>,
  name: string,
  selection?: Selection,
) {
  const base = Object.hasOwn(applications, name) ? applications[name] : undefined;
  if (base === undefined) {
    throw new FrontsError(
      frontsErrorCodes.resolutionFailed,
      `No application reference named "${name}" exists in this Host composition.`,
      { details: { name }, phase: 'resolve' },
    );
  }
  const selected = selection?.ref;
  const range =
    selected !== undefined && Object.hasOwn(selected, 'range') ? selected.range : undefined;
  const channel =
    selected !== undefined && Object.hasOwn(selected, 'channel') ? selected.channel : undefined;
  return {
    ...base,
    ...(range === undefined ? {} : { range }),
    ...(channel === undefined ? {} : { channel }),
    name,
  } satisfies AppRef;
}

function createResolutionPolicy(selection?: Selection): ResolutionPolicyContext | undefined {
  const selected = selection?.resolve;
  if (selected === undefined) {
    return undefined;
  }
  const environment = Object.hasOwn(selected, 'environment') ? selected.environment : undefined;
  const tenant = Object.hasOwn(selected, 'tenant') ? selected.tenant : undefined;
  const cohort = Object.hasOwn(selected, 'cohort') ? selected.cohort : undefined;
  const metadata = Object.hasOwn(selected, 'metadata') ? selected.metadata : undefined;
  return {
    ...(environment === undefined ? {} : { environment }),
    ...(tenant === undefined ? {} : { tenant }),
    ...(cohort === undefined ? {} : { cohort }),
    ...(metadata === undefined ? {} : { metadata }),
  };
}

type RuntimeAppProps<Source> = AppControls<object, Source, ContainerRequest> & {
  readonly app: string;
  readonly props: object;
};

function buildReactBindings<
  Contracts extends ApplicationContractShape<Contracts>,
  Source,
  Services extends object,
>(composition: HostComposition<Contracts, Source, Services>): ReactBindings<Contracts, Source> {
  const applications = composition.applications as Readonly<
    Record<string, Readonly<AppRef> | undefined>
  >;
  const renderApp = (input: RuntimeAppProps<Source>): ReactElement => {
    const { app, container, props, selection, ...controls } = input;
    const reference = createReference(applications, app, selection);
    const resolution = createResolutionPolicy(selection);
    const request = toContainer(container);

    return (
      <RemoteApp<object, Source, Services, ContainerRequest>
        {...controls}
        app={reference}
        appProps={props}
        host={composition.host}
        {...(request === undefined ? {} : { container: request })}
        {...(resolution === undefined ? {} : { resolve: resolution })}
      />
    );
  };
  const App = renderApp as unknown as ReactAppComponent<Contracts, Source>;

  const component = <
    Name extends ApplicationName<Contracts>,
    Request extends ContainerRequest = BuiltInContainerRequest,
  >(
    name: Name,
    defaults: ComponentDefaults<Contracts[Name], Source, Request> = {},
  ): ComponentType<Contracts[Name]> => {
    const BoundApplication = (props: Contracts[Name]): ReactElement =>
      renderApp({
        ...(defaults as AppControls<object, Source, ContainerRequest>),
        app: name,
        props,
      });
    BoundApplication.displayName = `FrontsApplication(${name})`;
    return BoundApplication;
  };

  const preload = async <Name extends ApplicationName<Contracts>>(
    app: Name,
    options: PreloadOptions = {},
  ): Promise<void> => {
    const reference = createReference(applications, app, options.selection);
    const resolution = createResolutionPolicy(options.selection);
    await composition.host.preload(reference, {
      ...resolution,
      ...(options.traceId === undefined ? {} : { traceId: options.traceId }),
    });
  };

  return Object.freeze({ App, component, preload });
}

export function createReactBindings<
  Contracts extends ApplicationContractShape<Contracts>,
  Source,
  Services extends object,
>(composition: HostComposition<Contracts, Source, Services>): ReactBindings<Contracts, Source>;
export function createReactBindings<Contracts extends ApplicationContractShape<Contracts>>(): <
  Source,
  Services extends object,
>(
  composition: HostComposition<Contracts, Source, Services>,
) => ReactBindings<Contracts, Source>;
export function createReactBindings(
  composition?: HostComposition<ApplicationContractShape<object>, unknown, object>,
):
  | ReactBindings<ApplicationContractShape<object>, unknown>
  | ((
      value: HostComposition<ApplicationContractShape<object>, unknown, object>,
    ) => ReactBindings<ApplicationContractShape<object>, unknown>) {
  if (composition === undefined) {
    return (value) => buildReactBindings(value);
  }
  return buildReactBindings(composition);
}
