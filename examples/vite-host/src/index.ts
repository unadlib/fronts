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

interface ProducerConfig {
  readonly appName: string;
  readonly displayName: string;
  readonly entry: string;
  readonly id: string;
  readonly remoteName: string;
}

function resolveProducer(value: string | null): ProducerConfig {
  switch (value) {
    case null:
    case 'official':
      return {
        appName: 'vite-catalog',
        displayName: '@module-federation/vite',
        entry: 'http://127.0.0.1:4201/mf-manifest.json',
        id: 'official',
        remoteName: 'fronts_vite_remote',
      };
    case 'vite-plugin-federation':
      return {
        appName: 'vite-plugin-catalog',
        displayName: 'vite-plugin-federation',
        entry: 'http://127.0.0.1:4202/mf-manifest.json',
        id: 'vite-plugin-federation',
        remoteName: 'fronts_vite_plugin_federation_remote',
      };
    default:
      throw new Error(`Unsupported Vite federation producer "${value}".`);
  }
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
const producer = resolveProducer(new URL(window.location.href).searchParams.get('producer'));
const source = createModuleFederationSource({
  entry: producer.entry,
  name: producer.remoteName,
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
    { match: { name: producer.appName }, resolve: { source, version: '2.0.0' } },
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
    ref: { expose: './application', name: producer.appName },
    target,
    traceId: `${producer.id}-runtime-example`,
  });
  auditOutput.textContent = `Host audit: ${producer.displayName} remote ready`;
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
