import {
  assertAppHandle,
  getFrontsApp,
  type AppHandle,
  type ApplicationIdentity,
} from '../app/index.js';
import { FrontsError, frontsErrorCodes, stringifyUnknown } from '../errors.js';
import { acquireWithAbort, raceWithAbort } from '../host/utils.js';
import type { AppLoader } from '../host/index.js';
import {
  assertResolvedApp,
  normalizeAppRef,
  type NormalizedAppRef,
  type ResolvedApp,
} from '../resolver/index.js';
import {
  FRONTS_IFRAME_PROTOCOL,
  isIframeConnectMessage,
  parseIframeCapabilities,
  serializeIframeError,
  type IframeConnectMessage,
  type IframeServiceCall,
} from './protocol.js';
import { IframeRpcPeer } from './rpc.js';
import { assertIframeTimeout } from './validation.js';

export interface IframeAgentOptions<Source> {
  readonly loader: AppLoader<Source>;
  readonly target: Element | ShadowRoot;
  readonly allowedOrigins: readonly string[];
  readonly hostId?: string;
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

function createIdentityEnvelope(identity: ApplicationIdentity): ApplicationIdentity {
  const { expose, instanceId, name, traceId, version } = identity;
  return Object.freeze({
    instanceId,
    name,
    ...(expose === undefined ? {} : { expose }),
    ...(version === undefined ? {} : { version }),
    ...(traceId === undefined ? {} : { traceId }),
  });
}

function createResolvedEnvelope<Source>(
  resolved: ResolvedApp<Source>,
  ref: NormalizedAppRef,
): ResolvedApp<Source> {
  const { metadata, ...deployment } = resolved;
  return Object.freeze({
    ...deployment,
    ref,
    ...(metadata === undefined ? {} : { metadata: Object.freeze({ ...metadata }) }),
  });
}

function isIframeConnectCandidate(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const message = value as { readonly protocol?: unknown; readonly type?: unknown };
  return message.protocol === FRONTS_IFRAME_PROTOCOL && message.type === 'connect';
}

function assertSessionIdentity<Source>(
  value: unknown,
  ref: NormalizedAppRef,
  resolved: ResolvedApp<Source>,
): asserts value is ApplicationIdentity {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new FrontsError(frontsErrorCodes.iframeProtocol, 'Invalid iframe application identity.');
  }
  const identity = value as Partial<ApplicationIdentity>;
  if (
    typeof identity.instanceId !== 'string' ||
    identity.instanceId.trim() === '' ||
    identity.instanceId !== identity.instanceId.trim() ||
    identity.name !== ref.name ||
    (identity.expose !== undefined && identity.expose !== ref.expose) ||
    (identity.version !== undefined &&
      (typeof identity.version !== 'string' ||
        identity.version.trim() === '' ||
        identity.version !== identity.version.trim() ||
        (resolved.version !== undefined && identity.version !== resolved.version))) ||
    (identity.traceId !== undefined &&
      (typeof identity.traceId !== 'string' ||
        identity.traceId.trim() === '' ||
        identity.traceId !== identity.traceId.trim()))
  ) {
    throw new FrontsError(
      frontsErrorCodes.iframeProtocol,
      'Iframe application identity does not match its resolved application.',
      { phase: 'mount' },
    );
  }
}

function validateAllowedOrigins(origins: readonly string[]): Set<string> {
  if (!Array.isArray(origins) || origins.length === 0 || origins.includes('*')) {
    throw new FrontsError(
      frontsErrorCodes.iframeProtocol,
      'Iframe agents require at least one explicit parent origin.',
    );
  }
  return new Set(
    origins.map((origin) => {
      try {
        if (typeof origin !== 'string') {
          throw new TypeError('origin is not a string');
        }
        const parsed = new URL(origin);
        if (parsed.origin === origin) {
          return origin;
        }
        throw new TypeError('origin is not canonical');
      } catch (error) {
        throw new FrontsError(
          frontsErrorCodes.iframeProtocol,
          `Invalid iframe agent origin "${stringifyUnknown(origin)}".`,
          { cause: error },
        );
      }
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
  const ref = normalizeAppRef(message.ref);
  assertResolvedApp<Source>(message.resolved, ref);
  assertSessionIdentity(message.identity, ref, message.resolved);
  const identity = createIdentityEnvelope(message.identity);
  const resolved = createResolvedEnvelope(message.resolved, ref);
  const controller = new AbortController();
  const availableCapabilities = parseIframeCapabilities(
    message.capabilities,
    'Iframe host capabilities',
  );
  const root = options.target.ownerDocument.createElement('div');
  root.dataset.frontsAgentInstance = identity.instanceId;
  options.target.append(root);
  let peer: IframeRpcPeer;
  try {
    peer = new IframeRpcPeer(port, {
      channelId: message.channelId,
      idPrefix: 'agent',
      ...(options.requestTimeoutMs === undefined
        ? {}
        : { requestTimeoutMs: options.requestTimeoutMs }),
    });
  } catch (error) {
    root.remove();
    throw error;
  }
  let handle: AppHandle<Props> | undefined;
  let stopped = false;
  let cleanupPromise: Promise<void> | undefined;
  const abandonedCleanups: Promise<void>[] = [];

  const loaded = (async () => {
    const module = await raceWithAbort(
      options.loader.load(
        resolved,
        Object.freeze({
          hostId: options.hostId ?? 'fronts-iframe-agent',
          identity,
          intent: 'mount',
          operationId: message.channelId,
          signal: controller.signal,
          traceId: identity.traceId ?? message.channelId,
        }),
      ),
      controller.signal,
      'load',
    );
    const app = getFrontsApp<Props, object>(module);
    const requestedCapabilities = parseIframeCapabilities(
      app.capabilities ?? [],
      'Iframe application capabilities',
    );
    for (const capability of requestedCapabilities) {
      if (!availableCapabilities.includes(capability)) {
        throw new FrontsError(
          frontsErrorCodes.capabilityDenied,
          `Iframe application requested undeclared capability "${capability}".`,
          { phase: 'mount' },
        );
      }
    }
    const negotiated = await peer.request<unknown>(
      'capabilities.negotiate',
      requestedCapabilities,
      { signal: controller.signal },
    );
    const grantedCapabilities = parseIframeCapabilities(negotiated, 'Iframe granted capabilities');
    if (
      grantedCapabilities.length !== requestedCapabilities.length ||
      requestedCapabilities.some((capability) => !grantedCapabilities.includes(capability))
    ) {
      throw new FrontsError(
        frontsErrorCodes.capabilityDenied,
        'Iframe host did not grant the complete application capability set.',
        { phase: 'mount' },
      );
    }
    const services = createRemoteServices<object>(grantedCapabilities, peer, controller.signal);

    const mounted = await acquireWithAbort({
      acquire: () =>
        app.mount(
          Object.freeze({
            identity,
            props: message.props as Readonly<Props>,
            services,
            signal: controller.signal,
            target: root,
          }),
        ),
      cleanup: async (handle) => handle.unmount(),
      onAbandoned: (cleanup) => abandonedCleanups.push(cleanup),
      phase: 'mount',
      signal: controller.signal,
    });
    handle = mounted;
    assertAppHandle(mounted);
    if (mounted.ready !== undefined) {
      await raceWithAbort(mounted.ready, controller.signal, 'ready');
    }
    peer.notify('fronts.ready');
    return mounted;
  })();

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

  const cleanupApplication = (): Promise<void> => {
    cleanupPromise ??= (async () => {
      if (handle !== undefined) {
        await handle.unmount();
      } else {
        await loaded.then((mounted) => mounted.unmount()).catch(() => undefined);
      }
      await Promise.all(abandonedCleanups);
    })();
    return cleanupPromise;
  };

  const stop = async (): Promise<void> => {
    if (stopped) {
      return;
    }
    stopped = true;
    controller.abort('Iframe session stopped');
    try {
      await cleanupApplication();
    } finally {
      root.remove();
      peer.close('Iframe session stopped');
      remove();
    }
  };

  void loaded.catch((error: unknown) => {
    if (peer.closed) {
      return;
    }
    try {
      peer.notify('fronts.fatal', serializeIframeError(error));
    } catch {
      void stop().catch(() => undefined);
    }
  });

  peer.handle('lifecycle.unmount', async () => {
    controller.abort('Iframe application unmounted');
    try {
      await cleanupApplication();
    } finally {
      handle = undefined;
      root.remove();
      remove();
      setTimeout(() => peer.close('Iframe application unmounted'), 0);
    }
  });

  return { stop };
}

function closePorts(ports: readonly MessagePort[]): void {
  for (const port of ports) {
    port.close();
  }
}

function reportConnectFailure<Source>(
  port: MessagePort,
  channelId: string,
  options: IframeAgentOptions<Source>,
  error: unknown,
): void {
  try {
    const peer = new IframeRpcPeer(port, {
      channelId,
      idPrefix: 'agent-rejected',
      ...(options.requestTimeoutMs === undefined
        ? {}
        : { requestTimeoutMs: options.requestTimeoutMs }),
    });
    peer.notify('fronts.fatal', serializeIframeError(error));
    setTimeout(() => peer.close('Iframe connection rejected'), 0);
  } catch {
    port.close();
  }
}

export function createIframeAgent<Source>(options: IframeAgentOptions<Source>): IframeAgent {
  assertIframeTimeout(options.requestTimeoutMs ?? 10_000, 'requestTimeoutMs');
  const allowedOrigins = validateAllowedOrigins(options.allowedOrigins);
  const targetWindow = options.window ?? window;
  const expectedParent = options.parent ?? targetWindow.parent;
  const sessions = new Map<string, AgentSession>();
  let stopped = false;
  let stopPromise: Promise<void> | undefined;

  const receive = (event: MessageEvent<unknown>) => {
    if (!isIframeConnectCandidate(event.data)) {
      return;
    }
    if (stopped || !allowedOrigins.has(event.origin) || event.source !== expectedParent) {
      closePorts(event.ports);
      return;
    }
    if (!isIframeConnectMessage(event.data) || event.ports.length !== 1) {
      closePorts(event.ports);
      return;
    }

    const port = event.ports[0];
    if (port === undefined) {
      return;
    }
    const channelId = event.data.channelId;
    if (sessions.has(channelId)) {
      reportConnectFailure(
        port,
        channelId,
        options,
        new FrontsError(
          frontsErrorCodes.iframeProtocol,
          `Iframe channel "${channelId}" already has an active session.`,
        ),
      );
      return;
    }
    try {
      const session = createSession(event.data as IframeConnectMessage<Source>, port, options, () =>
        sessions.delete(channelId),
      );
      sessions.set(channelId, session);
    } catch (error) {
      reportConnectFailure(port, channelId, options, error);
    }
  };
  targetWindow.addEventListener('message', receive);

  return {
    get sessions() {
      return sessions.size;
    },
    stop() {
      if (stopPromise !== undefined) {
        return stopPromise;
      }
      stopped = true;
      targetWindow.removeEventListener('message', receive);
      stopPromise = Promise.resolve().then(async () => {
        const results = await Promise.allSettled(
          [...sessions.values()].map((session) => session.stop()),
        );
        sessions.clear();
        const failures = results.flatMap((result) =>
          result.status === 'rejected' ? [result.reason] : [],
        );
        if (failures.length > 0) {
          throw new FrontsError(
            frontsErrorCodes.lifecycleFailed,
            'One or more iframe applications failed to stop cleanly.',
            {
              cause: new AggregateError(failures),
              details: { failureCount: failures.length },
              phase: 'unmount',
            },
          );
        }
      });
      return stopPromise;
    },
  };
}
