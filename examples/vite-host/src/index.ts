import { createInstance } from '@module-federation/runtime';

import {
  createDomContainer,
  createFrontsHost,
  createStaticResolver,
  type MountedApplication,
} from '@fronts/core';
import {
  createModuleFederationAdapter,
  createModuleFederationSource,
  type ModuleFederationSource,
} from '@fronts/mf';

import './styles.css';

interface CatalogProps {
  readonly revision: number;
}

interface ViteHostServices {
  readonly telemetry: {
    emit(name: string, data?: unknown): void;
  };
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Missing #${id}.`);
  }
  return element;
}

const target = requireElement('application-slot');
const eventOutput = requireElement('service-event');
const auditOutput = requireElement('host-audit');
const updateButton = requireElement('update-application') as HTMLButtonElement;
const unmountButton = requireElement('unmount-application') as HTMLButtonElement;
const source = createModuleFederationSource({
  entry: 'http://127.0.0.1:4201/mf-manifest.json',
  name: 'fronts_vite_remote',
  type: 'module',
});
const federation = createInstance({ name: 'fronts_plain_vite_host', remotes: [] });
const services: ViteHostServices = {
  telemetry: {
    emit(name, data) {
      const revision =
        typeof data === 'object' && data !== null ? Reflect.get(data, 'revision') : undefined;
      eventOutput.textContent =
        typeof revision === 'number' ? `Service event: ${name} · revision ${revision}` : name;
      eventOutput.dataset.eventName = name;
    },
  },
};
const host = createFrontsHost<ModuleFederationSource, ViteHostServices>({
  containers: [createDomContainer()],
  hostId: 'fronts-plain-vite-host',
  loader: createModuleFederationAdapter({ instance: federation }),
  resolver: createStaticResolver([
    { match: { name: 'vite-catalog' }, resolve: { source, version: '2.0.0' } },
  ]),
  services,
});

let revision = 1;
let application: MountedApplication<CatalogProps, ModuleFederationSource> | undefined;

async function run(action: () => Promise<void>): Promise<void> {
  updateButton.disabled = true;
  unmountButton.disabled = true;
  try {
    await action();
  } catch (error) {
    auditOutput.textContent = error instanceof Error ? error.message : String(error);
    auditOutput.dataset.state = 'error';
  } finally {
    updateButton.disabled = application === undefined;
    unmountButton.disabled = application === undefined;
  }
}

async function main(): Promise<void> {
  application = await host.mount<CatalogProps>({
    instanceId: 'vite-catalog-example',
    props: { revision },
    ref: { expose: './application', name: 'vite-catalog' },
    target,
    traceId: 'vite-runtime-example',
  });
  auditOutput.textContent = 'Host audit: Vite remote ready';
  auditOutput.dataset.state = 'ready';

  updateButton.addEventListener('click', () => {
    void run(async () => {
      revision += 1;
      await application?.update({ revision });
    });
  });
  unmountButton.addEventListener('click', () => {
    void run(async () => {
      await application?.unmount();
      application = undefined;
      host.assertIdle();
      auditOutput.textContent = 'Host audit: idle';
      auditOutput.dataset.state = 'idle';
    });
  });
}

window.addEventListener(
  'beforeunload',
  () => {
    void host.dispose();
  },
  { once: true },
);

void main().catch((error: unknown) => {
  auditOutput.textContent = error instanceof Error ? error.message : String(error);
  auditOutput.dataset.state = 'error';
});
