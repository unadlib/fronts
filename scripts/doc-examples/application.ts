import { defineApp } from '@fronts/core';

/**
 * A producer module a shell can import directly.
 *
 * Documentation examples import this fixture as `./application.js` so a module-loader example shows
 * the real inference path from a producer's own `defineApp` declaration.
 */
export interface NoticeProps {
  readonly revision: number;
}

interface NoticeServices {
  readonly telemetry: { emit(name: string, data?: unknown): void };
}

export default defineApp<NoticeProps, NoticeServices>({
  name: 'notice',
  capabilities: ['telemetry'],
  mount({ props, services, target }) {
    const element = document.createElement('p');
    element.textContent = `Revision ${props.revision}`;
    target.append(element);
    services.telemetry.emit('notice.mounted');

    return {
      update(next) {
        element.textContent = `Revision ${next.revision}`;
      },
      unmount() {
        element.remove();
      },
    };
  },
});
