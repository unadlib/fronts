import { createInstance } from '@module-federation/runtime';

import {
  createDomContainer,
  createFrontsHost,
  createShadowContainer,
  createStaticResolver,
} from '@fronts/core';
import { createIframeContainer, createIframeProxyLoader } from '@fronts/core/iframe';
import {
  createModuleFederationAdapter,
  createModuleFederationSource,
  type ModuleFederationSource,
} from '@fronts/mf';

export interface HostServices {
  readonly navigation: { go(path: string): void };
  readonly telemetry: { emit(name: string, data?: unknown): void };
}

export type ExampleSource = ModuleFederationSource;

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
    resolve: {
      metadata: {
        frame: {
          src: 'http://127.0.0.1:4103',
          targetOrigin: 'http://127.0.0.1:4103',
        },
      },
      source: reactRemote,
      version: '2.0.0',
    },
  },
]);

const federation = createInstance({ name: 'fronts_react_host', remotes: [] });
const federationLoader = createModuleFederationAdapter({ instance: federation });

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
  loader: federationLoader,
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
