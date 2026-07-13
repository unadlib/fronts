import { defineApp } from '@fronts/core';

export interface NoticeProps {
  readonly revision: number;
}

export interface CoreOnlyServices {
  readonly telemetry: {
    emit(name: string, data?: unknown): void;
  };
}

export default defineApp<NoticeProps, CoreOnlyServices>({
  capabilities: ['telemetry'],
  name: 'local-notice',
  mount({ props, services, signal, target }) {
    const card = document.createElement('article');
    card.className = 'notice-card';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'Vanilla DOM · custom loader';

    const heading = document.createElement('h2');
    const description = document.createElement('p');
    description.textContent = 'This application was loaded without Module Federation.';

    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = 'Emit scoped telemetry';

    let revision = props.revision;
    const render = () => {
      heading.textContent = `Notice revision ${revision}`;
    };
    const emitAction = () => {
      services.telemetry.emit('notice.action', { revision });
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
    services.telemetry.emit('notice.mounted', { revision });

    return {
      update(nextProps) {
        revision = nextProps.revision;
        render();
        services.telemetry.emit('notice.updated', { revision });
      },
      unmount: remove,
    };
  },
});
