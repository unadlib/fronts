import { createInstance } from '@module-federation/runtime';

import { createIframeAgent } from '@fronts/core/iframe';
import { createModuleFederationAdapter, type ModuleFederationSource } from '@fronts/mf';

import './styles.css';

const target = document.createElement('main');
target.id = 'isolated-applications';
document.body.append(target);

const federation = createInstance({ name: 'fronts_iframe_agent', remotes: [] });
const loader = createModuleFederationAdapter({ instance: federation });
const agent = createIframeAgent<ModuleFederationSource>({
  allowedOrigins: ['http://127.0.0.1:4100'],
  loader,
  target,
});

window.addEventListener(
  'beforeunload',
  () => {
    void agent.stop();
  },
  { once: true },
);
