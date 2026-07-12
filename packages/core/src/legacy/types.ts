import type { FrontsApp, MaybePromise, ServiceKey } from '../app/index.js';
import type { AppLoadContext, AppLoader } from '../host/index.js';
import type { ResolvedApp } from '../resolver/index.js';

export type LegacyUnmount = () => MaybePromise<void>;

type LegacyRenderWithCleanup<Props> = (
  target: HTMLElement | null,
  props?: Readonly<Props>,
) => LegacyUnmount;

type LegacyRenderWithoutCleanup<Props> = (
  target: HTMLElement | null,
  props?: Readonly<Props>,
) => void;

export type LegacyRender<Props = unknown> =
  LegacyRenderWithCleanup<Props> | LegacyRenderWithoutCleanup<Props>;

export interface LegacyFrontsModule<Props = unknown> {
  readonly default: LegacyRender<Props>;
}

export type LegacyUpdateMode = 'remount' | 'reject';

export interface AdaptLegacyFrontsAppOptions<Services extends object = object> {
  readonly name?: string;
  readonly capabilities?: readonly ServiceKey<Services>[];
  readonly updateMode?: LegacyUpdateMode;
}

export interface LegacyScriptSource {
  readonly url: string;
  readonly globalName?: string;
  readonly integrity?: string;
  readonly crossOrigin?: 'anonymous' | 'use-credentials';
  readonly nonce?: string;
  readonly referrerPolicy?: ReferrerPolicy;
}

export type LegacyOriginPolicy = readonly string[] | ((url: URL) => boolean);

export interface LegacyScriptLoaderOptions {
  readonly allowedOrigins?: LegacyOriginPolicy;
  readonly document?: Document;
  readonly removeScript?: boolean;
  readonly requireIntegrityForCrossOrigin?: boolean;
  readonly timeoutMs?: number;
  readonly updateMode?: LegacyUpdateMode;
}

export interface LegacyScriptLoader extends AppLoader<LegacyScriptSource> {
  load(
    resolved: ResolvedApp<LegacyScriptSource>,
    context: AppLoadContext,
  ): Promise<FrontsApp<unknown, object>>;
  preload(resolved: ResolvedApp<LegacyScriptSource>, context: AppLoadContext): Promise<void>;
  /**
   * Stops pending script loads, restores globals owned by this loader and
   * prevents any subsequent loads. Already-mounted applications remain usable.
   */
  dispose(): void;
}

export type AdaptedLegacyFrontsApp<Props = unknown, Services extends object = object> = FrontsApp<
  Props,
  Services
>;
