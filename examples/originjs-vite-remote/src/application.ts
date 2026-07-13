import { defineApp } from '@fronts/core';

import './application.css';

export interface CatalogProps {
  readonly revision: number;
}

export interface CatalogServices {
  readonly telemetry: {
    emit(name: string, data?: unknown): void;
  };
}

export default defineApp<CatalogProps, CatalogServices>({
  capabilities: ['telemetry'],
  name: 'originjs-catalog',
  mount({ props, services, signal, target }) {
    const card = document.createElement('article');
    card.dataset.originjsFrontsCard = '';
    card.style.background = '#ffffff';
    card.style.border = '1px solid #d8a793';
    card.style.borderRadius = '1rem';
    card.style.padding = '1.5rem';

    const eyebrow = document.createElement('p');
    eyebrow.textContent = 'Vite · OriginJS compatibility remote';
    const heading = document.createElement('h2');
    const description = document.createElement('p');
    description.textContent = 'The official MF runtime loaded this production ESM remote entry.';
    const shared = document.createElement('p');
    shared.dataset.sharedDependency = '@fronts/core';
    shared.textContent = 'Shared @fronts/core fallback active';
    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = 'Emit remote telemetry';

    let revision = props.revision;
    const render = () => {
      heading.textContent = `OriginJS catalog revision ${revision}`;
    };
    const emitAction = () => {
      services.telemetry.emit('originjs-catalog.action', { revision });
    };
    const remove = () => {
      action.removeEventListener('click', emitAction);
      card.remove();
    };

    render();
    action.addEventListener('click', emitAction);
    card.append(eyebrow, heading, description, shared, action);
    target.append(card);
    signal.addEventListener('abort', remove, { once: true });
    services.telemetry.emit('originjs-catalog.mounted', { revision });

    return {
      update(nextProps) {
        revision = nextProps.revision;
        render();
        services.telemetry.emit('originjs-catalog.updated', { revision });
      },
      unmount: remove,
    };
  },
});
