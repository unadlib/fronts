import { FrontsError, frontsErrorCodes, stringifyUnknown, throwIfAborted } from '../errors.js';
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
const requiredSandboxTokens = ['allow-same-origin', 'allow-scripts'] as const;

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

function validateOrigin(src: string, targetOrigin: string, baseUrl: string): URL {
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
    return source;
  } catch (error) {
    throw new FrontsError(
      frontsErrorCodes.iframeProtocol,
      'Iframe src and targetOrigin must resolve to the same explicit origin.',
      { cause: error, details: { src, targetOrigin }, phase: 'container' },
    );
  }
}

function getDocumentOrigin(document: Document): string | undefined {
  try {
    const origin = document.defaultView?.location.origin ?? new URL(document.URL).origin;
    return origin === 'null' ? undefined : origin;
  } catch {
    return undefined;
  }
}

function validateSandbox(
  value: unknown,
  sourceOrigin: string,
  document: Document,
): readonly string[] {
  const configured = value ?? requiredSandboxTokens;
  if (!Array.isArray(configured)) {
    throw new FrontsError(
      frontsErrorCodes.iframeProtocol,
      'Iframe sandbox must be an array of individual tokens.',
      { phase: 'container' },
    );
  }

  const tokens = new Set<string>();
  for (const token of configured as unknown[]) {
    if (
      typeof token !== 'string' ||
      token.trim() === '' ||
      token !== token.trim() ||
      /\s/.test(token)
    ) {
      throw new FrontsError(
        frontsErrorCodes.iframeProtocol,
        `Invalid iframe sandbox token "${stringifyUnknown(token)}".`,
        { phase: 'container' },
      );
    }
    tokens.add(token);
  }

  for (const required of requiredSandboxTokens) {
    if (!tokens.has(required)) {
      throw new FrontsError(
        frontsErrorCodes.iframeProtocol,
        `Iframe sandbox must include "${required}" for the origin-bound agent transport.`,
        { details: { required }, phase: 'container' },
      );
    }
  }

  const parentOrigin = getDocumentOrigin(document);
  if (parentOrigin !== undefined && sourceOrigin === parentOrigin) {
    throw new FrontsError(
      frontsErrorCodes.iframeProtocol,
      'Iframe agents must use a dedicated origin different from the host document.',
      { details: { origin: sourceOrigin }, phase: 'container' },
    );
  }
  return Object.freeze([...tokens]);
}

export function createIframeContainer<Source = unknown>(): ContainerAdapter<
  IframeContainerRequest,
  Source
> {
  return {
    type: 'iframe',
    prepare({ identity, request, signal, target }): PreparedContainer {
      throwIfAborted(signal, 'container');
      const document = target.ownerDocument;
      const source = validateOrigin(request.src, request.targetOrigin, document.baseURI);
      const sandbox = validateSandbox(request.sandbox, source.origin, document);

      const iframe = document.createElement('iframe');
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
      for (const token of sandbox) {
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
      try {
        target.append(iframe);
      } catch (error) {
        iframe.remove();
        throw error;
      }

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
