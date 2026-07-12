import type { ApplicationIdentity } from '../app/index.js';
import type { ContainerHostTarget } from './types.js';

export interface ElementOptions {
  readonly tagName?: string;
  readonly className?: string;
  readonly attributes?: Readonly<Record<string, string>>;
}

export function createContainerElement(
  target: ContainerHostTarget,
  identity: ApplicationIdentity,
  type: string,
  options: ElementOptions,
): HTMLElement {
  const element = target.ownerDocument.createElement(options.tagName ?? 'div');

  if (options.className !== undefined) {
    element.className = options.className;
  }
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    element.setAttribute(name, value);
  }

  element.dataset.frontsApp = identity.name;
  element.dataset.frontsContainer = type;
  element.dataset.frontsInstance = identity.instanceId;
  target.append(element);
  return element;
}

export function createElementDisposer(element: Element): () => void {
  let disposed = false;
  return () => {
    if (!disposed) {
      disposed = true;
      element.remove();
    }
  };
}
