import type { MaybePromise } from '../app/index.js';

export interface AppRef {
  readonly name: string;
  readonly expose?: string;
  readonly range?: string;
  readonly channel?: string;
}

export interface NormalizedAppRef {
  readonly name: string;
  readonly expose: string;
  readonly range?: string;
  readonly channel?: string;
}

export interface ResolveContext {
  readonly signal: AbortSignal;
  readonly environment?: string;
  readonly tenant?: string;
  readonly cohort?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ResolvedApp<Source = unknown> {
  readonly ref: NormalizedAppRef;
  readonly source: Source;
  readonly version?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type ResolvedAppInit<Source = unknown> = Omit<ResolvedApp<Source>, 'ref'>;

export interface AppResolver<Source = unknown> {
  resolve(ref: NormalizedAppRef, context: ResolveContext): MaybePromise<ResolvedApp<Source>>;
}

export type ResolveFunction<Source = unknown> = AppResolver<Source>['resolve'];
