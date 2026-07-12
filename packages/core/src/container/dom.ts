import { throwIfAborted } from '../errors.js';
import { createContainerElement, createElementDisposer } from './element.js';
import type { ContainerAdapter, DomContainerRequest, PreparedContainer } from './types.js';

export function createDomContainer(): ContainerAdapter<DomContainerRequest> {
  return {
    type: 'dom',
    prepare({ identity, request, signal, target }): PreparedContainer {
      throwIfAborted(signal, 'container');
      const element = createContainerElement(target, identity, 'dom', request);

      return {
        dispose: createElementDisposer(element),
        element,
        target: element,
        type: 'dom',
      };
    },
  };
}
