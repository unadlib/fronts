import { defineApp } from '@fronts/core';

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
  name: 'vite-catalog',
  mount({ props, services, signal, target }) {
    const card = document.createElement('article');
    card.style.background = '#ffffff';
    card.style.border = '1px solid #cfc7f5';
    card.style.borderRadius = '1rem';
    card.style.padding = '1.5rem';

    const eyebrow = document.createElement('p');
    eyebrow.textContent = 'Vite · Module Federation Remote';
    const heading = document.createElement('h2');
    const description = document.createElement('p');
    description.textContent = 'The host loaded this Fronts application through mf-manifest.json.';
    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = 'Emit remote telemetry';

    let revision = props.revision;
    const render = () => {
      heading.textContent = `Vite catalog revision ${revision}`;
    };
    const emitAction = () => {
      services.telemetry.emit('vite-catalog.action', { revision });
    };
    const remove = () => {
      action.removeEventListener('click', emitAction);
      card.remove();
    };

    render();
    action.addEventListener('click', emitAction);
    card.append(eyebrow, heading, description, action);
    target.append(card);
    signal.addEventListener('abort', remove, { once: true });
    services.telemetry.emit('vite-catalog.mounted', { revision });

    return {
      update(nextProps) {
        revision = nextProps.revision;
        render();
        services.telemetry.emit('vite-catalog.updated', { revision });
      },
      unmount: remove,
    };
  },
});
