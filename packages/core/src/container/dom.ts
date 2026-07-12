import { throwIfAborted } from '../errors.js';
import { createContainerElement, createElementDisposer } from './element.js';
import type { ContainerAdapter, DomContainerRequest, PreparedContainer } from './types.js';

export function createDomContainer<Source = unknown>(): ContainerAdapter<
  DomContainerRequest,
  Source
> {
  return {
    type: 'dom',
    prepare({ identity, request, signal, target }): PreparedContainer {
      throwIfAborted(signal, 'container');
      const element = createContainerElement(target, identity, 'dom', request);

      return {
        dispose: createElementDisposer(element),
        element,
        ownsElement: true,
        target: element,
        type: 'dom',
      };
    },
  };
}
