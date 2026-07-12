import { assertAppHandle, getFrontsApp, type AppHandle } from '../app/index.js';
import { FrontsError, frontsErrorCodes } from '../errors.js';
import { raceWithAbort } from '../host/utils.js';
import type { AppLoader } from '../host/index.js';
import { assertResolvedApp } from '../resolver/index.js';
import {
  isIframeConnectMessage,
  serializeIframeError,
  type IframeConnectMessage,
  type IframeServiceCall,
} from './protocol.js';
import { IframeRpcPeer } from './rpc.js';

export interface IframeAgentOptions<Source> {
  readonly loader: AppLoader<Source>;
  readonly target: Element | ShadowRoot;
  readonly allowedOrigins: readonly string[];
  readonly window?: Window;
  readonly parent?: MessageEventSource;
  readonly requestTimeoutMs?: number;
}

export interface IframeAgent {
  readonly sessions: number;
  stop(): Promise<void>;
}

interface AgentSession {
  readonly stop: () => Promise<void>;
}

function validateAllowedOrigins(origins: readonly string[]): Set<string> {
  if (origins.length === 0 || origins.includes('*')) {
    throw new FrontsError(
      frontsErrorCodes.iframeProtocol,
      'Iframe agents require at least one explicit parent origin.',
    );
  }
  return new Set(
    origins.map((origin) => {
      const parsed = new URL(origin);
      if (parsed.origin !== origin) {
        throw new FrontsError(
          frontsErrorCodes.iframeProtocol,
          `Invalid iframe agent origin "${origin}".`,
        );
      }
      return origin;
    }),
  );
}

function createRemoteServices<Services extends object>(
  capabilities: readonly string[],
  peer: IframeRpcPeer,
  signal: AbortSignal,
): Services {
  const services = Object.create(null) as Record<string, unknown>;
  for (const capability of capabilities) {
    if (['__proto__', 'constructor', 'prototype'].includes(capability)) {
      continue;
    }
    const service = new Proxy(Object.create(null) as object, {
      get(_target, property) {
        if (typeof property !== 'string' || property === 'then') {
          return undefined;
        }
        return (...args: unknown[]) =>
          peer.request(
            'service.call',
            { args, capability, method: property } satisfies IframeServiceCall,
            { signal },
          );
      },
    });
    Object.defineProperty(services, capability, {
      enumerable: true,
      value: service,
    });
  }
  return Object.freeze(services) as Services;
}

function createSession<Source, Props = unknown>(
  message: IframeConnectMessage<Source, Props>,
  port: MessagePort,
  options: IframeAgentOptions<Source>,
  remove: () => void,
): AgentSession {
  assertResolvedApp<Source>(message.resolved, message.ref);
  const controller = new AbortController();
  const peer = new IframeRpcPeer(port, {
    channelId: message.channelId,
    idPrefix: 'agent',
    ...(options.requestTimeoutMs === undefined
      ? {}
      : { requestTimeoutMs: options.requestTimeoutMs }),
  });
  const root = options.target.ownerDocument.createElement('div');
  root.dataset.frontsAgentInstance = message.identity.instanceId;
  options.target.append(root);
  const services = createRemoteServices<object>(message.capabilities, peer, controller.signal);
  let handle: AppHandle<Props> | undefined;
  let stopped = false;

  const loaded = (async () => {
    const module = await raceWithAbort(
      options.loader.load(message.resolved, { signal: controller.signal }),
      controller.signal,
      'load',
    );
    const app = getFrontsApp<Props, object>(module);
    for (const capability of app.capabilities ?? []) {
      if (!message.capabilities.includes(capability)) {
        throw new FrontsError(
          frontsErrorCodes.capabilityDenied,
          `Iframe application requested undeclared capability "${capability}".`,
          { phase: 'mount' },
        );
      }
    }

    const mounted = await raceWithAbort(
      app.mount({
        identity: message.identity,
        props: message.props as Readonly<Props>,
        services,
        signal: controller.signal,
        target: root,
      }),
      controller.signal,
      'mount',
    );
    assertAppHandle(mounted);
    handle = mounted;
    if (mounted.ready !== undefined) {
      await raceWithAbort(mounted.ready, controller.signal, 'ready');
    }
    peer.notify('fronts.ready');
    return mounted;
  })();
  void loaded.catch((error: unknown) => {
    if (!peer.closed) {
      peer.notify('fronts.fatal', serializeIframeError(error));
    }
  });

  const requireHandle = async (): Promise<AppHandle<Props>> => await loaded;
  peer.handle('lifecycle.update', async (props) => {
    const current = await requireHandle();
    if (current.update === undefined) {
      throw new FrontsError(
        frontsErrorCodes.lifecycleFailed,
        'Iframe application does not implement update().',
        { phase: 'update' },
      );
    }
    await current.update(props as Readonly<Props>);
  });
  peer.handle('lifecycle.activate', async () => (await requireHandle()).activate?.());
  peer.handle('lifecycle.deactivate', async () => (await requireHandle()).deactivate?.());

  const stop = async (): Promise<void> => {
    if (stopped) {
      return;
    }
    stopped = true;
    controller.abort('Iframe session stopped');
    try {
      if (handle !== undefined) {
        await handle.unmount();
      } else {
        await loaded.then((mounted) => mounted.unmount()).catch(() => undefined);
      }
    } finally {
      root.remove();
      peer.close('Iframe session stopped');
      remove();
    }
  };

  peer.handle('lifecycle.unmount', async () => {
    try {
      if (handle !== undefined) {
        await handle.unmount();
      }
    } finally {
      handle = undefined;
      root.remove();
      controller.abort('Iframe application unmounted');
      remove();
      setTimeout(() => peer.close('Iframe application unmounted'), 0);
    }
  });

  return { stop };
}

export function createIframeAgent<Source>(options: IframeAgentOptions<Source>): IframeAgent {
  const allowedOrigins = validateAllowedOrigins(options.allowedOrigins);
  const targetWindow = options.window ?? window;
  const expectedParent = options.parent ?? targetWindow.parent;
  const sessions = new Map<string, AgentSession>();
  let stopped = false;

  const receive = (event: MessageEvent<unknown>) => {
    if (
      stopped ||
      !allowedOrigins.has(event.origin) ||
      event.source !== expectedParent ||
      !isIframeConnectMessage(event.data) ||
      event.ports.length !== 1 ||
      sessions.has(event.data.channelId)
    ) {
      return;
    }

    const port = event.ports[0];
    if (port === undefined) {
      return;
    }
    const channelId = event.data.channelId;
    const session = createSession(event.data as IframeConnectMessage<Source>, port, options, () =>
      sessions.delete(channelId),
    );
    sessions.set(channelId, session);
  };
  targetWindow.addEventListener('message', receive);

  return {
    get sessions() {
      return sessions.size;
    },
    async stop() {
      if (stopped) {
        return;
      }
      stopped = true;
      targetWindow.removeEventListener('message', receive);
      await Promise.allSettled([...sessions.values()].map((session) => session.stop()));
      sessions.clear();
    },
  };
}
