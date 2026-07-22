import type { FrontsHost } from './host/index.js';
import type { AppRef } from './resolver/index.js';

declare const hostCompositionContracts: unique symbol;

/** Ensures every logical application name maps to an object-shaped props contract. */
export type ApplicationContractShape<Contracts extends object> = {
  readonly [Name in keyof Contracts]: object;
};

export type ApplicationName<Contracts extends ApplicationContractShape<Contracts>> = Extract<
  keyof Contracts,
  string
>;

/** Runtime references paired with the compile-time props contracts they address. */
export type ApplicationCatalog<Contracts extends ApplicationContractShape<Contracts>> = {
  readonly [Name in ApplicationName<Contracts>]: Readonly<
    Omit<AppRef, 'name'> & { readonly name: Name }
  >;
};

/**
 * Transport-neutral composition value consumed by framework bindings.
 *
 * The catalog preserves application reference defaults, including a non-default expose, across a
 * transport factory and a framework factory without coupling those packages to one another.
 */
export interface HostComposition<
  Contracts extends ApplicationContractShape<Contracts>,
  Source,
  Services extends object,
> {
  /** Type-only invariant marker; no runtime property is required. */
  readonly [hostCompositionContracts]?: (contracts: Contracts) => Contracts;
  readonly applications: ApplicationCatalog<Contracts>;
  readonly host: FrontsHost<Source, Services>;
}
