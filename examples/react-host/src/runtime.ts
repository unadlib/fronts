import { createDomContainer, createShadowContainer } from '@fronts/core';
import { createIframeContainer, createIframeProxyLoader } from '@fronts/core/iframe';
import { createMfHost, type ModuleFederationSource } from '@fronts/mf';
import { createReactBindings } from '@fronts/react';

export interface HostServices {
  readonly navigation: { go(path: string): void };
  readonly telemetry: { emit(name: string, data?: unknown): void };
}

export type ExampleSource = ModuleFederationSource;

export interface ExampleContracts {
  readonly 'isolated-checkout': { readonly cartId: string };
  readonly 'react-checkout': { readonly cartId: string };
  readonly 'vue-account': { readonly accountId: string };
}

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

export const composition = createMfHost<ExampleContracts, HostServices>({
  apps: {
    'isolated-checkout': {
      entry: 'http://127.0.0.1:4101/mf-manifest.json',
      metadata: {
        frame: {
          src: 'http://127.0.0.1:4103',
          targetOrigin: 'http://127.0.0.1:4103',
        },
      },
      remote: 'fronts_react_remote',
      version: '2.0.0',
    },
    'react-checkout': {
      entry: 'http://127.0.0.1:4101/mf-manifest.json',
      remote: 'fronts_react_remote',
      version: '2.0.0',
    },
    'vue-account': {
      entry: 'http://127.0.0.1:4102/mf-manifest.json',
      remote: 'fronts_vue_remote',
      version: '2.0.0',
    },
  },
  capabilityPolicy: ({ capability, identity }) =>
    capability !== 'navigation' || ['react-checkout', 'isolated-checkout'].includes(identity.name),
  containerLoaders: {
    iframe: createIframeProxyLoader<ExampleSource, HostServices>({
      capabilities: ['navigation', 'telemetry'],
    }),
  },
  containers: [createDomContainer(), createShadowContainer(), createIframeContainer()],
  name: 'fronts-example-shell',
  observer(event) {
    if (event.kind === 'error') {
      console.error('[fronts lifecycle]', event);
    } else {
      console.debug('[fronts lifecycle]', event);
    }
  },
  runtimeName: 'fronts_react_host',
  services,
});

export const host = composition.host;
export const applications = createReactBindings(composition);
