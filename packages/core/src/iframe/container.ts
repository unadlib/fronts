import { FrontsError, frontsErrorCodes, throwIfAborted } from '../errors.js';
import { createElementDisposer } from '../container/element.js';
import type { ContainerAdapter, ContainerRequest, PreparedContainer } from '../container/types.js';

export interface IframeContainerRequest extends ContainerRequest {
  readonly type: 'iframe';
  readonly src: string;
  readonly targetOrigin: string;
  readonly title: string;
  readonly sandbox?: readonly string[];
  readonly allow?: string;
  readonly className?: string;
  readonly name?: string;
  readonly loading?: 'eager' | 'lazy';
  readonly referrerPolicy?: ReferrerPolicy;
  readonly attributes?: Readonly<Record<string, string>>;
}

const controlledIframeAttributes = new Set([
  'allow',
  'class',
  'loading',
  'name',
  'referrerpolicy',
  'sandbox',
  'src',
  'srcdoc',
  'title',
]);

function assertCustomIframeAttribute(name: string): void {
  const normalized = name.toLowerCase();
  if (
    controlledIframeAttributes.has(normalized) ||
    normalized.startsWith('data-fronts-') ||
    normalized.startsWith('on')
  ) {
    throw new FrontsError(
      frontsErrorCodes.iframeProtocol,
      `Iframe attribute "${name}" is reserved by Fronts and cannot be set through attributes.`,
      { details: { attribute: name }, phase: 'container' },
    );
  }
}

function createChannelId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new FrontsError(
      frontsErrorCodes.iframeProtocol,
      'Secure iframe channels require crypto.randomUUID().',
      { phase: 'container' },
    );
  }
  return globalThis.crypto.randomUUID();
}

function validateOrigin(src: string, targetOrigin: string, baseUrl: string): void {
  if (targetOrigin === '*') {
    throw new FrontsError(
      frontsErrorCodes.iframeProtocol,
      'Iframe targetOrigin must be explicit; wildcard origins are forbidden.',
      { phase: 'container' },
    );
  }
  try {
    const expected = new URL(targetOrigin);
    const source = new URL(src, baseUrl);
    if (expected.origin !== targetOrigin || source.origin !== expected.origin) {
      throw new Error('origin mismatch');
    }
  } catch (error) {
    throw new FrontsError(
      frontsErrorCodes.iframeProtocol,
      'Iframe src and targetOrigin must resolve to the same explicit origin.',
      { cause: error, details: { src, targetOrigin }, phase: 'container' },
    );
  }
}

export function createIframeContainer(): ContainerAdapter<IframeContainerRequest> {
  return {
    type: 'iframe',
    prepare({ identity, request, signal, target }): PreparedContainer {
      throwIfAborted(signal, 'container');
      validateOrigin(request.src, request.targetOrigin, target.ownerDocument.baseURI);

      const iframe = target.ownerDocument.createElement('iframe');
      for (const [name, value] of Object.entries(request.attributes ?? {})) {
        assertCustomIframeAttribute(name);
        iframe.setAttribute(name, value);
      }
      iframe.className = request.className ?? '';
      iframe.name = request.name ?? '';
      iframe.title = request.title;
      iframe.loading = request.loading ?? 'eager';
      iframe.referrerPolicy = request.referrerPolicy ?? 'strict-origin-when-cross-origin';
      if (request.allow !== undefined) {
        iframe.allow = request.allow;
      }
      for (const token of request.sandbox ?? ['allow-scripts']) {
        iframe.sandbox.add(token);
      }

      iframe.dataset.frontsApp = identity.name;
      iframe.dataset.frontsChannel = createChannelId();
      iframe.dataset.frontsContainer = 'iframe';
      iframe.dataset.frontsFrameLoaded = 'false';
      iframe.dataset.frontsInstance = identity.instanceId;
      iframe.dataset.frontsTargetOrigin = request.targetOrigin;
      iframe.addEventListener(
        'load',
        () => {
          iframe.dataset.frontsFrameLoaded = 'true';
        },
        { once: true },
      );
      iframe.src = request.src;
      target.append(iframe);

      return {
        dispose: createElementDisposer(iframe),
        element: iframe,
        ownsElement: true,
        target: iframe,
        type: 'iframe',
      };
    },
  };
}
