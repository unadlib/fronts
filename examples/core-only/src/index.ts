import {
  createDomContainer,
  createFrontsHost,
  createStaticResolver,
  type AppLoader,
  type MountedApplication,
} from '@fronts/core';

import type { CoreOnlyServices, NoticeProps } from './application.js';
import './styles.css';

interface LocalSource {
  readonly module: 'notice';
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

const source: LocalSource = { module: 'notice' };
const loader: AppLoader<LocalSource> = {
  async load(resolved, context) {
    context.signal.throwIfAborted();
    if (resolved.source.module !== 'notice') {
      throw new Error(`Unknown local module: ${resolved.source.module}`);
    }
    return import('./application.js');
  },
};
const services: CoreOnlyServices = {
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
const host = createFrontsHost<LocalSource, CoreOnlyServices>({
  containers: [createDomContainer()],
  hostId: 'fronts-core-only-example',
  loader,
  resolver: createStaticResolver([
    { match: { name: 'local-notice' }, resolve: { source, version: '2.0.0' } },
  ]),
  services,
});

let revision = 1;
let application: MountedApplication<NoticeProps, LocalSource> | undefined;

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
  application = await host.mount<NoticeProps>({
    instanceId: 'local-notice-example',
    props: { revision },
    ref: { name: 'local-notice' },
    target,
    traceId: 'core-only-example',
  });
  auditOutput.textContent = 'Host audit: application ready';
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
