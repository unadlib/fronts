import {
  createModuleHost,
  type AppModuleSource,
  type FrontsAppModule,
  type HostComposition,
} from '../src/index.js';

interface NoticeProps {
  readonly revision: number;
}

interface CheckoutProps {
  readonly cartId: string;
}

interface Services {
  readonly telemetry: { emit(name: string): void };
}

declare const noticeModule: FrontsAppModule<NoticeProps, Services>;
declare const checkoutModule: FrontsAppModule<CheckoutProps, Services>;
declare const untypedModule: FrontsAppModule;

const composition = createModuleHost({
  apps: {
    // Asynchronous, synchronous, and deployment forms all contribute one contract each.
    checkout: () => checkoutModule,
    notice: () => Promise.resolve(noticeModule),
    untyped: { load: () => untypedModule, version: '1.0.0' },
  },
  name: 'shell',
});

// Contracts come from the applications themselves, so the shell declares no second copy.
const inferred: HostComposition<
  {
    readonly checkout: CheckoutProps;
    readonly notice: NoticeProps;
    readonly untyped: object;
  },
  AppModuleSource,
  object
> = composition;

// @ts-expect-error contracts stay invariant, so a different props shape is not interchangeable
const mismatched: HostComposition<
  {
    readonly checkout: NoticeProps;
    readonly notice: CheckoutProps;
    readonly untyped: object;
  },
  AppModuleSource,
  object
> = composition;

const name: 'checkout' = composition.applications.checkout.name;

// @ts-expect-error the catalog only contains configured application names
const missing = composition.applications.unknown;

const scoped = createModuleHost<{ readonly notice: () => typeof noticeModule }, Services>({
  apps: { notice: () => noticeModule },
  name: 'shell',
  services: { telemetry: { emit: () => undefined } },
});

const services: HostComposition<{ readonly notice: NoticeProps }, AppModuleSource, Services> =
  scoped;

// @ts-expect-error a module loader is required for every declared application
const incomplete = createModuleHost({ apps: { notice: 'https://example.com' }, name: 'shell' });

void inferred;
void mismatched;
void name;
void missing;
void services;
void incomplete;
