import { h, type Component, type FunctionalComponent, type VNodeChild } from 'vue';

import {
  FrontsError,
  frontsErrorCodes,
  type AppRef,
  type ApplicationContractShape,
  type ApplicationName,
  type BuiltInContainerRequest,
  type ContainerRequest,
  type ContainerRequestResolver,
  type FrontsHost,
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
  readonly loading?: VNodeChild;
  readonly fallback?: VNodeChild | ((failure: RemoteFailure) => VNodeChild);
  readonly arePropsEqual?: (previous: Props, next: Props) => boolean;
  readonly onReady?: (application: MountedApplication<Props, Source>) => void;
  readonly onError?: (error: Error) => void;
  readonly targetProps?: Readonly<Record<string, unknown>>;
  readonly wrapperProps?: Readonly<Record<string, unknown>>;
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

export interface VueAppComponent<Contracts extends ApplicationContractShape<Contracts>, Source> {
  <Request extends ContainerRequest = BuiltInContainerRequest>(
    props: BoundAppProps<Contracts, Source, Request>,
    context: Parameters<FunctionalComponent<BoundAppProps<Contracts, Source, Request>>>[1],
  ): VNodeChild;
  displayName?: string;
}

export type ComponentDefaults<
  Props,
  Source,
  Request extends ContainerRequest = BuiltInContainerRequest,
> = Omit<AppControls<Props, Source, Request>, 'instanceId'>;

export interface PreloadOptions {
  readonly selection?: Selection;
  readonly traceId?: string;
}

export interface VueBindings<Contracts extends ApplicationContractShape<Contracts>, Source> {
  /** Inline form for an application or control options that vary per render. */
  readonly App: VueAppComponent<Contracts, Source>;

  /** Stable component factory whose public props are exactly the application props. */
  component<
    Name extends ApplicationName<Contracts>,
    Request extends ContainerRequest = BuiltInContainerRequest,
  >(
    name: Name,
    defaults?: ComponentDefaults<Contracts[Name], Source, Request>,
  ): FunctionalComponent<Contracts[Name]>;

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
  return {
    ...base,
    ...selection?.ref,
    name,
  } satisfies AppRef;
}

type RuntimeAppProps<Source> = AppControls<object, Source, ContainerRequest> & {
  readonly app: string;
  readonly props: object;
};

function buildVueBindings<
  Contracts extends ApplicationContractShape<Contracts>,
  Source,
  Services extends object,
>(composition: HostComposition<Contracts, Source, Services>): VueBindings<Contracts, Source> {
  const applications = composition.applications as Readonly<
    Record<string, Readonly<AppRef> | undefined>
  >;
  const renderApp = (input: RuntimeAppProps<Source>) => {
    const { app, container, props, selection, wrapperProps, ...controls } = input;
    const reference = createReference(applications, app, selection);
    const request = toContainer(container);

    return h(RemoteApp as Component, {
      ...wrapperProps,
      ...controls,
      app: reference,
      appProps: props,
      host: composition.host as unknown as FrontsHost<unknown, object>,
      ...(request === undefined ? {} : { container: request }),
      ...(selection?.resolve === undefined ? {} : { resolve: selection.resolve }),
    });
  };
  const App = ((input: RuntimeAppProps<Source>) => renderApp(input)) as unknown as VueAppComponent<
    Contracts,
    Source
  >;
  App.displayName = 'FrontsApplication';

  const component = <
    Name extends ApplicationName<Contracts>,
    Request extends ContainerRequest = BuiltInContainerRequest,
  >(
    name: Name,
    defaults: ComponentDefaults<Contracts[Name], Source, Request> = {},
  ): FunctionalComponent<Contracts[Name]> => {
    const BoundApplication = ((props: Contracts[Name]) =>
      renderApp({
        ...(defaults as AppControls<object, Source, ContainerRequest>),
        app: name,
        props,
      })) as FunctionalComponent<Contracts[Name]>;
    BoundApplication.displayName = `FrontsApplication(${name})`;
    return BoundApplication;
  };

  const preload = async <Name extends ApplicationName<Contracts>>(
    app: Name,
    options: PreloadOptions = {},
  ): Promise<void> => {
    const reference = createReference(applications, app, options.selection);
    await composition.host.preload(reference, {
      ...options.selection?.resolve,
      ...(options.traceId === undefined ? {} : { traceId: options.traceId }),
    });
  };

  return Object.freeze({ App, component, preload });
}

export function createVueBindings<
  Contracts extends ApplicationContractShape<Contracts>,
  Source,
  Services extends object,
>(composition: HostComposition<Contracts, Source, Services>): VueBindings<Contracts, Source>;
export function createVueBindings<Contracts extends ApplicationContractShape<Contracts>>(): <
  Source,
  Services extends object,
>(
  composition: HostComposition<Contracts, Source, Services>,
) => VueBindings<Contracts, Source>;
export function createVueBindings(
  composition?: HostComposition<ApplicationContractShape<object>, unknown, object>,
):
  | VueBindings<ApplicationContractShape<object>, unknown>
  | ((
      value: HostComposition<ApplicationContractShape<object>, unknown, object>,
    ) => VueBindings<ApplicationContractShape<object>, unknown>) {
  if (composition === undefined) {
    return (value) => buildVueBindings(value);
  }
  return buildVueBindings(composition);
}
