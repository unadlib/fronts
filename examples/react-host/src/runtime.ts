import { createInstance } from '@module-federation/runtime';

import {
  createDomContainer,
  createFrontsHost,
  createShadowContainer,
  createStaticResolver,
  type AppLoader,
  type ResolvedApp,
} from '@fronts/core';
import { createIframeContainer, createIframeProxyLoader } from '@fronts/core/iframe';
import { createLegacyScriptLoader, type LegacyScriptSource } from '@fronts/core/legacy';
import {
  createModuleFederationAdapter,
  createModuleFederationSource,
  type ModuleFederationSource,
} from '@fronts/mf';

export interface HostServices {
  readonly navigation: { go(path: string): void };
  readonly telemetry: { emit(name: string, data?: unknown): void };
}

export type ExampleSource = LegacyScriptSource | ModuleFederationSource;

function isFederated(source: ExampleSource): source is ModuleFederationSource {
  return 'remote' in source;
}

function narrowResolved<Source>(resolved: ResolvedApp<ExampleSource>): ResolvedApp<Source> {
  return resolved as unknown as ResolvedApp<Source>;
}

const reactRemote = createModuleFederationSource({
  entry: 'http://127.0.0.1:4101/mf-manifest.json',
  name: 'fronts_react_remote',
});
const vueRemote = createModuleFederationSource({
  entry: 'http://127.0.0.1:4102/mf-manifest.json',
  name: 'fronts_vue_remote',
});

const resolver = createStaticResolver<ExampleSource>([
  {
    match: { channel: 'stable', name: 'react-checkout' },
    resolve: { source: reactRemote, version: '2.0.0' },
  },
  {
    match: { name: 'react-checkout' },
    resolve: { source: reactRemote, version: '2.0.0' },
  },
  {
    match: { name: 'vue-account' },
    resolve: { source: vueRemote, version: '2.0.0' },
  },
  {
    match: { name: 'isolated-checkout' },
    resolve: { source: reactRemote, version: '2.0.0' },
  },
  {
    match: { name: 'legacy-orders' },
    resolve: {
      source: {
        globalName: 'legacy-orders',
        url: 'http://127.0.0.1:4104/legacy-orders.js',
      },
      version: '0.1.1',
    },
  },
]);

const federation = createInstance({ name: 'fronts_react_host', remotes: [] });
const federationLoader = createModuleFederationAdapter({ instance: federation });
export const legacyLoader = createLegacyScriptLoader({
  allowedOrigins: [window.location.origin, 'http://127.0.0.1:4104'],
  // This is a local development fixture. Production cross-origin legacy scripts
  // should keep the default SRI requirement enabled.
  requireIntegrityForCrossOrigin: false,
});

const loader: AppLoader<ExampleSource> = {
  async load(resolved, context) {
    return isFederated(resolved.source)
      ? await federationLoader.load(narrowResolved<ModuleFederationSource>(resolved), context)
      : await legacyLoader.load(narrowResolved<LegacyScriptSource>(resolved), context);
  },
  async preload(resolved, context) {
    if (isFederated(resolved.source)) {
      await federationLoader.preload?.(narrowResolved<ModuleFederationSource>(resolved), context);
    } else {
      await legacyLoader.preload(narrowResolved<LegacyScriptSource>(resolved), context);
    }
  },
};

const services: HostServices = {
  navigation: {
    go(path) {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
  },
  telemetry: {
    emit(name, data) {
      console.info('[fronts telemetry]', name, data);
    },
  },
};

export const host = createFrontsHost<ExampleSource, HostServices>({
  capabilityPolicy: ({ capability, identity }) =>
    capability !== 'navigation' || ['react-checkout', 'isolated-checkout'].includes(identity.name),
  containerLoaders: {
    iframe: createIframeProxyLoader<ExampleSource, HostServices>({
      capabilities: ['navigation', 'telemetry'],
    }),
  },
  containers: [createDomContainer(), createShadowContainer(), createIframeContainer()],
  hostId: 'fronts-example-shell',
  loader,
  observer(event) {
    if (event.kind === 'error') {
      console.error('[fronts lifecycle]', event);
    } else {
      console.debug('[fronts lifecycle]', event);
    }
  },
  resolver,
  services,
});
