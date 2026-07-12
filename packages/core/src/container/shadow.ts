import { throwIfAborted } from '../errors.js';
import { createContainerElement, createElementDisposer } from './element.js';
import type { ContainerAdapter, PreparedContainer, ShadowContainerRequest } from './types.js';

export function createShadowContainer<Source = unknown>(): ContainerAdapter<
  ShadowContainerRequest,
  Source
> {
  return {
    type: 'shadow',
    prepare({ identity, request, signal, target }): PreparedContainer {
      throwIfAborted(signal, 'container');
      const element = createContainerElement(target, identity, 'shadow', request);

      try {
        const shadowRoot = element.attachShadow({
          delegatesFocus: request.delegatesFocus ?? false,
          mode: request.mode ?? 'open',
        });

        return {
          dispose: createElementDisposer(element),
          element,
          ownsElement: true,
          target: shadowRoot,
          type: 'shadow',
        };
      } catch (error) {
        element.remove();
        throw error;
      }
    },
  };
}
