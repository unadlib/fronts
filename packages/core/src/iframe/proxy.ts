import { defineApp, type AppHandle, type FrontsApp, type ServiceKey } from '../app/index.js';
import { FrontsError, frontsErrorCodes, throwIfAborted } from '../errors.js';
import type { AppLoader } from '../host/index.js';
import type { ResolvedApp } from '../resolver/index.js';
import {
  createIframeConnectMessage,
  type IframeServiceCall,
  type SerializedIframeError,
} from './protocol.js';
import { IframeRpcPeer } from './rpc.js';
import { assertIframeTimeout } from './validation.js';

export interface IframeProxyLoaderOptions<Source, Services extends object> {
  readonly capabilities?:
    | readonly ServiceKey<Services>[]
    | ((resolved: ResolvedApp<Source>) => readonly ServiceKey<Services>[]);
  readonly createMessageChannel?: () => MessageChannel;
  readonly handshakeTimeoutMs?: number;
  readonly requestTimeoutMs?: number;
}

function assertIframeTarget(target: Element | ShadowRoot): asserts target is HTMLIFrameElement {
  if (!(target instanceof Element) || target.tagName !== 'IFRAME') {
    throw new FrontsError(
      frontsErrorCodes.iframeProtocol,
      'The iframe proxy loader requires an iframe container target.',
      { phase: 'mount' },
    );
  }
}

function toRemoteError(payload: unknown): FrontsError {
  const serialized = payload as Partial<SerializedIframeError> | undefined;
  return new FrontsError(
    frontsErrorCodes.iframeProtocol,
    serialized?.message ?? 'The iframe application failed before becoming ready.',
    {
      details: {
        ...(serialized?.code === undefined ? {} : { remoteCode: serialized.code }),
        ...(serialized?.name === undefined ? {} : { remoteName: serialized.name }),
        ...(serialized?.phase === undefined ? {} : { remotePhase: serialized.phase }),
      },
      phase: 'ready',
    },
  );
}

function waitForFrameLoad(
  iframe: HTMLIFrameElement,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<void> {
  throwIfAborted(signal, 'mount');
  if (iframe.dataset.frontsFrameLoaded === 'true') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      iframe.removeEventListener('load', loaded);
      iframe.removeEventListener('error', failed);
      signal.removeEventListener('abort', aborted);
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
    const loaded = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(
        new FrontsError(frontsErrorCodes.iframeProtocol, 'The iframe document failed to load.', {
          phase: 'mount',
        }),
      );
    };
    const aborted = () => {
      cleanup();
      reject(
        new FrontsError(frontsErrorCodes.aborted, 'Iframe mounting was aborted.', {
          cause: signal.reason,
          phase: 'mount',
        }),
      );
    };

    iframe.addEventListener('load', loaded, { once: true });
    iframe.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', aborted, { once: true });
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        cleanup();
        reject(
          new FrontsError(
            frontsErrorCodes.rpcTimeout,
            `Iframe handshake timed out after ${timeoutMs}ms.`,
            { details: { timeoutMs }, phase: 'mount' },
          ),
        );
      }, timeoutMs);
    }
  });
}

function parseServiceCall(value: unknown): IframeServiceCall {
  if (typeof value !== 'object' || value === null) {
    throw new FrontsError(frontsErrorCodes.iframeProtocol, 'Invalid iframe service call.');
  }
  const call = value as Partial<IframeServiceCall>;
  if (
    typeof call.capability !== 'string' ||
    typeof call.method !== 'string' ||
    !Array.isArray(call.args) ||
    ['__proto__', 'constructor', 'prototype'].includes(call.method)
  ) {
    throw new FrontsError(frontsErrorCodes.iframeProtocol, 'Invalid iframe service method.');
  }
  return call as IframeServiceCall;
}

async function invokeService<Services extends object>(
  services: Readonly<Services>,
  value: unknown,
): Promise<unknown> {
  const call = parseServiceCall(value);
  const service = Reflect.get(services, call.capability) as unknown;
  if ((typeof service !== 'object' && typeof service !== 'function') || service === null) {
    throw new FrontsError(
      frontsErrorCodes.capabilityDenied,
      `Iframe application cannot access capability "${call.capability}".`,
    );
  }
  const method = Reflect.get(service, call.method) as unknown;
  if (typeof method !== 'function') {
    throw new FrontsError(
      frontsErrorCodes.capabilityDenied,
      `Capability "${call.capability}" does not expose method "${call.method}".`,
    );
  }
  return await Reflect.apply(method, service, call.args);
}

export function createIframeProxyLoader<Source, Services extends object = object, Props = unknown>(
  options: IframeProxyLoaderOptions<Source, Services> = {},
): AppLoader<Source> {
  const handshakeTimeoutMs = options.handshakeTimeoutMs ?? 10_000;
  const requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
  assertIframeTimeout(handshakeTimeoutMs, 'handshakeTimeoutMs');
  assertIframeTimeout(requestTimeoutMs, 'requestTimeoutMs');

  return {
    load(resolved): FrontsApp<Props, Services> {
      const capabilities =
        typeof options.capabilities === 'function'
          ? options.capabilities(resolved)
          : (options.capabilities ?? []);

      return defineApp<Props, Services>({
        capabilities,
        name: resolved.ref.name,
        mount(context): AppHandle<Props> {
          assertIframeTarget(context.target);
          const iframe = context.target;
          const channelId = iframe.dataset.frontsChannel;
          const targetOrigin = iframe.dataset.frontsTargetOrigin;
          if (
            channelId === undefined ||
            channelId === '' ||
            targetOrigin === undefined ||
            targetOrigin === '' ||
            targetOrigin === '*'
          ) {
            throw new FrontsError(
              frontsErrorCodes.iframeProtocol,
              'The iframe container is missing a secure channel or target origin.',
              { phase: 'mount' },
            );
          }

          const channel = (options.createMessageChannel ?? (() => new MessageChannel()))();
          const peer = new IframeRpcPeer(channel.port1, {
            channelId,
            idPrefix: 'host',
            ...(options.requestTimeoutMs === undefined
              ? {}
              : { requestTimeoutMs: options.requestTimeoutMs }),
          });
          peer.handle('service.call', (params) => invokeService(context.services, params));

          let connected = false;
          let disposed = false;
          let resolveReady: () => void;
          let rejectReady: (reason: unknown) => void;
          const agentReady = new Promise<void>((resolve, reject) => {
            resolveReady = resolve;
            rejectReady = reject;
          });
          peer.on('fronts.ready', () => resolveReady());
          peer.on('fronts.fatal', (error) => rejectReady(toRemoteError(error)));

          const ready = (async () => {
            await waitForFrameLoad(iframe, context.signal, handshakeTimeoutMs);
            throwIfAborted(context.signal, 'mount');
            const frameWindow = iframe.contentWindow;
            if (frameWindow === null) {
              throw new FrontsError(
                frontsErrorCodes.iframeProtocol,
                'The iframe does not have an active content window.',
                { phase: 'mount' },
              );
            }

            const message = createIframeConnectMessage<Source, Props, Services>({
              capabilities,
              channelId,
              identity: context.identity,
              props: context.props as Props,
              ref: resolved.ref,
              resolved,
            });
            frameWindow.postMessage(message, targetOrigin, [channel.port2]);
            connected = true;

            if (handshakeTimeoutMs === 0) {
              await agentReady;
            } else {
              let timer: ReturnType<typeof setTimeout> | undefined;
              try {
                await Promise.race([
                  agentReady,
                  new Promise<never>((_resolve, reject) => {
                    timer = setTimeout(
                      () =>
                        reject(
                          new FrontsError(
                            frontsErrorCodes.rpcTimeout,
                            `Iframe agent handshake timed out after ${handshakeTimeoutMs}ms.`,
                            { details: { handshakeTimeoutMs }, phase: 'ready' },
                          ),
                        ),
                      handshakeTimeoutMs,
                    );
                  }),
                ]);
              } finally {
                if (timer !== undefined) {
                  clearTimeout(timer);
                }
              }
            }
          })();

          return {
            ready,
            activate: () => peer.request('lifecycle.activate', undefined),
            deactivate: () => peer.request('lifecycle.deactivate', undefined),
            update: (props) => peer.request('lifecycle.update', props),
            async unmount(): Promise<void> {
              if (disposed) {
                return;
              }
              disposed = true;
              try {
                if (connected && !peer.closed) {
                  await peer.request('lifecycle.unmount', undefined, {
                    ...(options.requestTimeoutMs === undefined
                      ? {}
                      : { timeoutMs: options.requestTimeoutMs }),
                  });
                }
              } finally {
                peer.close('Iframe application unmounted');
                if (!connected) {
                  channel.port2.close();
                }
              }
            },
          };
        },
      });
    },
  };
}
