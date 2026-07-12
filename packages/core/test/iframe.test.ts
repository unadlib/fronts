import { describe, expect, it, vi } from 'vitest';

import {
  assertAppHandle,
  createFrontsHost,
  defineApp,
  frontsErrorCodes,
  getFrontsApp,
  normalizeAppRef,
  type AppLoader,
  type ApplicationHostOperationContext,
  type ApplicationIdentity,
  type FrontsError,
  type ResolvedApp,
} from '../src/index.js';
import {
  IframeRpcPeer,
  FRONTS_IFRAME_PROTOCOL,
  FRONTS_IFRAME_PROTOCOL_VERSION,
  createIframeAgent,
  createIframeConnectMessage,
  createIframeContainer,
  createIframeProxyLoader,
} from '../src/iframe/index.js';

interface Source {
  readonly entry: string;
}

interface Props {
  readonly value: string;
}

interface Services {
  readonly navigation: {
    go(path: string): Promise<void> | void;
  };
  readonly telemetry: {
    emit(name: string): Promise<void> | void;
  };
}

const identity: ApplicationIdentity = {
  instanceId: 'checkout-frame',
  name: 'checkout',
  traceId: 'checkout-frame-trace',
  version: '2.0.0',
};

function createOperation(signal = new AbortController().signal): ApplicationHostOperationContext {
  return {
    hostId: 'iframe-test-host',
    identity,
    intent: 'mount',
    operationId: 'iframe-test-operation',
    signal,
    traceId: 'checkout-frame-trace',
  };
}

describe('secure iframe execution', () => {
  it('creates an origin-bound iframe container with an isolated channel', async () => {
    const target = document.createElement('main');
    const operation = createOperation();
    const prepared = await createIframeContainer().prepare({
      identity,
      operation,
      request: {
        attributes: { 'aria-label': 'Checkout application', id: 'checkout-iframe' },
        sandbox: ['allow-same-origin', 'allow-scripts'],
        src: 'https://frame.example.test/app',
        targetOrigin: 'https://frame.example.test',
        title: 'Checkout',
        type: 'iframe',
      },
      signal: operation.signal,
      target,
    });
    const iframe = prepared.element as HTMLIFrameElement;

    expect(iframe.src).toBe('https://frame.example.test/app');
    expect(iframe.getAttribute('aria-label')).toBe('Checkout application');
    expect(iframe.id).toBe('checkout-iframe');
    expect(iframe.title).toBe('Checkout');
    expect(iframe.sandbox.contains('allow-scripts')).toBe(true);
    expect(iframe.sandbox.contains('allow-same-origin')).toBe(true);
    expect(iframe.dataset.frontsTargetOrigin).toBe('https://frame.example.test');
    expect(iframe.dataset.frontsChannel).toMatch(/^[\da-f-]{20,}$/i);
    expect(prepared.target).toBe(iframe);

    iframe.dispatchEvent(new Event('load'));
    expect(iframe.dataset.frontsFrameLoaded).toBe('true');
    await prepared.dispose();
    expect(target.children).toHaveLength(0);
  });

  it('preserves the dedicated child origin required by the secure handshake', async () => {
    const operation = createOperation();
    const prepared = await createIframeContainer().prepare({
      identity,
      operation,
      request: {
        src: 'https://frame.example.test/app',
        targetOrigin: 'https://frame.example.test',
        title: 'Checkout',
        type: 'iframe',
      },
      signal: operation.signal,
      target: document.createElement('main'),
    });
    const iframe = prepared.element as HTMLIFrameElement;

    expect(iframe.sandbox.contains('allow-scripts')).toBe(true);
    expect(iframe.sandbox.contains('allow-same-origin')).toBe(true);
    await prepared.dispose();
  });

  it.each([
    { required: 'allow-same-origin', sandbox: ['allow-scripts'] },
    { required: 'allow-scripts', sandbox: ['allow-same-origin'] },
  ])('rejects an iframe agent sandbox without $required', ({ required, sandbox }) => {
    const target = document.createElement('main');
    const operation = createOperation();

    expect(() =>
      createIframeContainer().prepare({
        identity,
        operation,
        request: {
          sandbox,
          src: 'https://frame.example.test/app',
          targetOrigin: 'https://frame.example.test',
          title: 'Checkout',
          type: 'iframe',
        },
        signal: operation.signal,
        target,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.iframeProtocol,
        details: { required },
      }),
    );
    expect(target.children).toHaveLength(0);
  });

  it('rejects an iframe agent deployed on the host origin', () => {
    const target = document.createElement('main');
    const operation = createOperation();
    const documentOrigin = document.defaultView?.location.origin ?? new URL(document.URL).origin;

    expect(() =>
      createIframeContainer().prepare({
        identity,
        operation,
        request: {
          src: `${documentOrigin}/frame`,
          targetOrigin: documentOrigin,
          title: 'Checkout',
          type: 'iframe',
        },
        signal: operation.signal,
        target,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.iframeProtocol,
        details: { origin: documentOrigin },
      }),
    );
    expect(target.children).toHaveLength(0);
  });

  it.each(['sandbox', 'srcdoc', 'allow', 'onload', 'data-fronts-channel'])(
    'rejects the controlled iframe attribute %s',
    (attribute) => {
      const operation = createOperation();
      const target = document.createElement('main');

      expect(() =>
        createIframeContainer().prepare({
          identity,
          operation,
          request: {
            attributes: { [attribute]: 'unsafe-value' },
            src: 'https://frame.example.test/app',
            targetOrigin: 'https://frame.example.test',
            title: 'Checkout',
            type: 'iframe',
          },
          signal: operation.signal,
          target,
        }),
      ).toThrowError(
        expect.objectContaining<Partial<FrontsError>>({
          code: frontsErrorCodes.iframeProtocol,
          details: { attribute },
        }),
      );
      expect(target.children).toHaveLength(0);
    },
  );

  it('forbids wildcard and mismatched iframe origins', () => {
    const target = document.createElement('main');
    const prepare = (targetOrigin: string) => {
      const operation = createOperation();
      return createIframeContainer().prepare({
        identity,
        operation,
        request: {
          src: 'https://frame.example.test/app',
          targetOrigin,
          title: 'Checkout',
          type: 'iframe',
        },
        signal: operation.signal,
        target,
      });
    };

    expect(() => prepare('*')).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.iframeProtocol }),
    );
    expect(() => prepare('https://other.example.test')).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.iframeProtocol }),
    );
    expect(target.children).toHaveLength(0);
  });

  it('provides correlated, cancellable, timeout-aware MessagePort RPC', async () => {
    const channel = new MessageChannel();
    const host = new IframeRpcPeer(channel.port1, {
      channelId: 'channel-1',
      idPrefix: 'host',
      requestTimeoutMs: 20,
    });
    const frame = new IframeRpcPeer(channel.port2, {
      channelId: 'channel-1',
      idPrefix: 'frame',
      requestTimeoutMs: 20,
    });
    frame.handle('math.add', (params) => {
      const values = params as { left: number; right: number };
      return values.left + values.right;
    });
    frame.handle('never', () => new Promise(() => undefined));

    await expect(host.request('math.add', { left: 2, right: 3 })).resolves.toBe(5);
    await expect(host.request('missing')).rejects.toThrow('No iframe RPC handler');
    await expect(host.request('never', undefined, { timeoutMs: 5 })).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.rpcTimeout }),
    );

    const controller = new AbortController();
    const cancelled = host.request('never', undefined, { signal: controller.signal });
    controller.abort('navigation');
    await expect(cancelled).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.aborted }),
    );

    host.close();
    frame.close();
  });

  it('ignores malformed iframe RPC wire messages', async () => {
    const channelId = 'malformed-rpc';
    const channel = new MessageChannel();
    const peer = new IframeRpcPeer(channel.port1, {
      channelId,
      requestTimeoutMs: 20,
    });
    const handler = vi.fn(() => 'handled');
    peer.handle('local.method', handler);
    const base = {
      channelId,
      protocol: FRONTS_IFRAME_PROTOCOL,
      protocolVersion: FRONTS_IFRAME_PROTOCOL_VERSION,
    };
    channel.port2.addEventListener('message', (event: MessageEvent<unknown>) => {
      const request = event.data as { id?: unknown; type?: unknown };
      if (request.type === 'request') {
        channel.port2.postMessage({
          ...base,
          id: request.id,
          ok: 'yes',
          result: 'forged-result',
          type: 'response',
        });
      }
    });
    channel.port2.start();

    await expect(peer.request('remote.method', undefined, { timeoutMs: 5 })).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.rpcTimeout }),
    );

    channel.port2.postMessage({
      ...base,
      id: 42,
      method: 'local.method',
      params: undefined,
      type: 'request',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handler).not.toHaveBeenCalled();

    peer.close();
    channel.port2.close();
  });

  it('does not dispatch duplicate in-flight iframe RPC request ids', async () => {
    const channelId = 'duplicate-rpc-id';
    const channel = new MessageChannel();
    const peer = new IframeRpcPeer(channel.port1, { channelId });
    let requestSignal: AbortSignal | undefined;
    const handler = vi.fn(
      (_params: unknown, context: { readonly signal: AbortSignal }) =>
        new Promise<void>(() => {
          requestSignal = context.signal;
        }),
    );
    peer.handle('local.method', handler);
    const request = {
      channelId,
      id: 'remote:1',
      method: 'local.method',
      params: undefined,
      protocol: FRONTS_IFRAME_PROTOCOL,
      protocolVersion: FRONTS_IFRAME_PROTOCOL_VERSION,
      type: 'request',
    };
    channel.port2.postMessage(request);
    channel.port2.postMessage(request);
    await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());

    channel.port2.postMessage({
      channelId,
      id: request.id,
      protocol: FRONTS_IFRAME_PROTOCOL,
      protocolVersion: FRONTS_IFRAME_PROTOCOL_VERSION,
      type: 'cancel',
    });
    await vi.waitFor(() => expect(requestSignal?.aborted).toBe(true));

    peer.close();
    channel.port2.close();
  });

  it('isolates iframe RPC notification listeners from one another', async () => {
    const channel = new MessageChannel();
    const sender = new IframeRpcPeer(channel.port1, { channelId: 'notification-observers' });
    const receiver = new IframeRpcPeer(channel.port2, { channelId: 'notification-observers' });
    const first = vi.fn(() => {
      throw new Error('observer failed');
    });
    const second = vi.fn();
    receiver.on('status', first);
    receiver.on('status', second);

    sender.notify('status', { ready: true });

    await vi.waitFor(() => expect(second).toHaveBeenCalledWith({ ready: true }));
    expect(first).toHaveBeenCalledOnce();
    sender.close();
    receiver.close();
  });

  it('notifies the remote iframe RPC peer when a channel closes', async () => {
    const channel = new MessageChannel();
    const host = new IframeRpcPeer(channel.port1, {
      channelId: 'closed-channel',
      requestTimeoutMs: 0,
    });
    const frame = new IframeRpcPeer(channel.port2, {
      channelId: 'closed-channel',
      requestTimeoutMs: 0,
    });
    frame.handle('never', () => new Promise(() => undefined));
    const pending = host.request('never');

    frame.close('Iframe agent stopped');

    await expect(pending).rejects.toMatchObject({
      code: frontsErrorCodes.rpcClosed,
      message: 'Iframe agent stopped',
    });
    expect(host.closed).toBe(true);
    host.close();
  });

  it('fails fast for invalid iframe timeout configuration', async () => {
    const channel = new MessageChannel();
    expect(
      () =>
        new IframeRpcPeer(channel.port1, {
          channelId: 'invalid-timeout',
          requestTimeoutMs: Number.NaN,
        }),
    ).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.iframeProtocol }),
    );
    channel.port1.close();
    channel.port2.close();

    expect(() => createIframeProxyLoader({ handshakeTimeoutMs: -1 })).toThrow(
      'handshakeTimeoutMs must be a finite, non-negative duration',
    );
    expect(() =>
      createIframeAgent({
        allowedOrigins: ['https://shell.example.test'],
        loader: { load: vi.fn() },
        requestTimeoutMs: Number.POSITIVE_INFINITY,
        target: document.createElement('main'),
      }),
    ).toThrow('requestTimeoutMs must be a finite, non-negative duration');

    const validChannel = new MessageChannel();
    const peer = new IframeRpcPeer(validChannel.port1, {
      channelId: 'request-timeout',
    });
    await expect(peer.request('method', undefined, { timeoutMs: -1 })).rejects.toThrow(
      'timeoutMs must be a finite, non-negative duration',
    );
    peer.close();
    validChannel.port2.close();
  });

  it('fails fast for invalid or closed iframe RPC registrations and methods', () => {
    const channel = new MessageChannel();
    const peer = new IframeRpcPeer(channel.port1, { channelId: 'validated-rpc' });

    expect(() => peer.handle(' ', vi.fn())).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.iframeProtocol }),
    );
    expect(() => peer.on('', vi.fn())).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.iframeProtocol }),
    );
    expect(() => peer.request(' padded ')).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.iframeProtocol }),
    );
    expect(() => peer.notify('')).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.iframeProtocol }),
    );

    peer.close();
    expect(() => peer.handle('method', vi.fn())).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.rpcClosed }),
    );
    expect(() => peer.on('event', vi.fn())).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.rpcClosed }),
    );
    channel.port2.close();
  });

  it('settles iframe readiness when unmounted before the frame loads', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    iframe.dataset.frontsChannel = crypto.randomUUID();
    iframe.dataset.frontsTargetOrigin = 'https://frame.example.test';
    const ref = normalizeAppRef({ name: 'checkout' });
    const resolved: ResolvedApp<Source> = {
      ref,
      source: { entry: 'checkout.js' },
    };
    const proxyApp = getFrontsApp<Props, object>(
      await createIframeProxyLoader<Source, object, Props>({
        handshakeTimeoutMs: 0,
      }).load(resolved, createOperation()),
    );
    const handle = await proxyApp.mount({
      identity,
      props: { value: 'cancelled' },
      services: {},
      signal: new AbortController().signal,
      target: iframe,
    });
    const ready = Promise.resolve(handle.ready);
    void ready.catch(() => undefined);

    await handle.unmount();

    await expect(ready).rejects.toMatchObject({
      code: frontsErrorCodes.aborted,
      phase: 'mount',
    });
    iframe.remove();
  });

  it('reports malformed iframe connections without leaking a session', async () => {
    const parentOrigin = 'https://shell.example.test';
    const channelId = 'malformed-connect';
    const channel = new MessageChannel();
    const parentPeer = new IframeRpcPeer(channel.port1, { channelId, idPrefix: 'parent' });
    const load = vi.fn<AppLoader<Source>['load']>();
    const agent = createIframeAgent({
      allowedOrigins: [parentOrigin],
      loader: { load },
      parent: window,
      target: document.createElement('main'),
      window,
    });
    const ref = normalizeAppRef({ name: 'checkout' });
    const message = createIframeConnectMessage({
      capabilities: [],
      channelId,
      identity,
      props: { value: 'invalid' },
      ref,
      resolved: { ref, source: { entry: 'checkout.js' } },
    });
    let fatal: unknown;
    parentPeer.on('fronts.fatal', (error) => {
      fatal = error;
    });

    expect(() =>
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { ...message, resolved: { ref } },
          origin: parentOrigin,
          ports: [channel.port2],
          source: window,
        }),
      ),
    ).not.toThrow();

    await vi.waitFor(() =>
      expect(fatal).toMatchObject({ code: frontsErrorCodes.resolutionFailed }),
    );
    expect(agent.sessions).toBe(0);
    expect(load).not.toHaveBeenCalled();

    parentPeer.close();
    await agent.stop();
  });

  it('does not close ports transferred by unrelated window protocols', async () => {
    const agent = createIframeAgent({
      allowedOrigins: ['https://shell.example.test'],
      loader: { load: vi.fn() },
      parent: window,
      target: document.createElement('main'),
      window,
    });
    const unrelated = new MessageChannel();
    let received: unknown;
    unrelated.port1.addEventListener('message', (event: MessageEvent<unknown>) => {
      received = event.data;
    });
    unrelated.port1.start();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { protocol: 'another.runtime', type: 'connect' },
        origin: 'https://other.example.test',
        ports: [unrelated.port1],
        source: window,
      }),
    );
    unrelated.port2.postMessage('still connected');

    await vi.waitFor(() => expect(received).toBe('still connected'));
    unrelated.port1.close();
    unrelated.port2.close();
    await agent.stop();
  });

  it('rejects iframe identities that disagree with the resolved application', async () => {
    const parentOrigin = 'https://shell.example.test';
    const channelId = 'mismatched-identity';
    const channel = new MessageChannel();
    const parentPeer = new IframeRpcPeer(channel.port1, { channelId, idPrefix: 'parent' });
    const load = vi.fn<AppLoader<Source>['load']>();
    const target = document.createElement('main');
    const agent = createIframeAgent({
      allowedOrigins: [parentOrigin],
      loader: { load },
      parent: window,
      target,
      window,
    });
    const ref = normalizeAppRef({ name: 'checkout' });
    const message = createIframeConnectMessage({
      capabilities: [],
      channelId,
      identity: { ...identity, name: 'forged-name' },
      props: {},
      ref,
      resolved: { ref, source: { entry: 'checkout.js' } },
    });
    let fatal: unknown;
    parentPeer.on('fronts.fatal', (error) => {
      fatal = error;
    });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: message,
        origin: parentOrigin,
        ports: [channel.port2],
        source: window,
      }),
    );

    await vi.waitFor(() => expect(fatal).toMatchObject({ code: frontsErrorCodes.iframeProtocol }));
    expect(agent.sessions).toBe(0);
    expect(load).not.toHaveBeenCalled();
    expect(target.children).toHaveLength(0);

    parentPeer.close();
    await agent.stop();
  });

  it('makes concurrent iframe agent stops await the same cleanup', async () => {
    const parentOrigin = 'https://shell.example.test';
    const channelId = 'concurrent-stop';
    let releaseCleanup!: () => void;
    const cleanup = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    const unmount = vi.fn(() => cleanup);
    const remoteApp = defineApp({ mount: () => ({ unmount }) });
    const agent = createIframeAgent({
      allowedOrigins: [parentOrigin],
      loader: { load: async () => ({ default: remoteApp }) },
      parent: window,
      target: document.createElement('main'),
      window,
    });
    const channel = new MessageChannel();
    const parentPeer = new IframeRpcPeer(channel.port1, { channelId, idPrefix: 'parent' });
    parentPeer.handle('capabilities.negotiate', () => []);
    let ready = false;
    parentPeer.on('fronts.ready', () => {
      ready = true;
    });
    const ref = normalizeAppRef({ name: 'checkout' });
    const message = createIframeConnectMessage({
      capabilities: [],
      channelId,
      identity,
      props: {},
      ref,
      resolved: { ref, source: { entry: 'checkout.js' } },
    });
    window.dispatchEvent(
      new MessageEvent('message', {
        data: message,
        origin: parentOrigin,
        ports: [channel.port2],
        source: window,
      }),
    );
    await vi.waitFor(() => expect(ready).toBe(true));

    const firstStop = agent.stop();
    let secondStopSettled = false;
    const secondStop = agent.stop().then(() => {
      secondStopSettled = true;
    });
    await vi.waitFor(() => expect(unmount).toHaveBeenCalledOnce());
    expect(secondStopSettled).toBe(false);

    releaseCleanup();
    await Promise.all([firstStop, secondStop]);
    expect(agent.sessions).toBe(0);
    parentPeer.close();
  });

  it('waits for an abandoned iframe mount to clean up before stopping', async () => {
    const parentOrigin = 'https://shell.example.test';
    const channelId = 'abandoned-mount';
    let finishMount!: (handle: { unmount(): Promise<void> }) => void;
    const mounted = new Promise<{ unmount(): Promise<void> }>((resolve) => {
      finishMount = resolve;
    });
    let finishCleanup!: () => void;
    const cleanup = new Promise<void>((resolve) => {
      finishCleanup = resolve;
    });
    const unmount = vi.fn(() => cleanup);
    const mount = vi.fn(() => mounted);
    const remoteApp = defineApp({ mount });
    const target = document.createElement('main');
    const agent = createIframeAgent({
      allowedOrigins: [parentOrigin],
      loader: { load: async () => ({ default: remoteApp }) },
      parent: window,
      target,
      window,
    });
    const channel = new MessageChannel();
    const parentPeer = new IframeRpcPeer(channel.port1, { channelId, idPrefix: 'parent' });
    parentPeer.handle('capabilities.negotiate', () => []);
    const ref = normalizeAppRef({ name: 'checkout' });
    const message = createIframeConnectMessage({
      capabilities: [],
      channelId,
      identity,
      props: {},
      ref,
      resolved: { ref, source: { entry: 'checkout.js' } },
    });
    window.dispatchEvent(
      new MessageEvent('message', {
        data: message,
        origin: parentOrigin,
        ports: [channel.port2],
        source: window,
      }),
    );
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce());

    let stopped = false;
    const stopping = agent.stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);

    finishMount({ unmount });
    await vi.waitFor(() => expect(unmount).toHaveBeenCalledOnce());
    expect(stopped).toBe(false);

    finishCleanup();
    await stopping;
    expect(agent.sessions).toBe(0);
    expect(target.children).toHaveLength(0);
    parentPeer.close();
  });

  it('reports iframe application failures after stopping every session resource', async () => {
    const parentOrigin = 'https://shell.example.test';
    const channelId = 'failed-stop';
    const cleanupFailure = new Error('iframe application cleanup failed');
    const unmount = vi.fn(async () => {
      throw cleanupFailure;
    });
    const remoteApp = defineApp({ mount: () => ({ unmount }) });
    const target = document.createElement('main');
    const agent = createIframeAgent({
      allowedOrigins: [parentOrigin],
      loader: { load: async () => ({ default: remoteApp }) },
      parent: window,
      target,
      window,
    });
    const channel = new MessageChannel();
    const parentPeer = new IframeRpcPeer(channel.port1, { channelId, idPrefix: 'parent' });
    parentPeer.handle('capabilities.negotiate', () => []);
    let ready = false;
    parentPeer.on('fronts.ready', () => {
      ready = true;
    });
    const ref = normalizeAppRef({ name: 'checkout' });
    const message = createIframeConnectMessage({
      capabilities: [],
      channelId,
      identity,
      props: {},
      ref,
      resolved: { ref, source: { entry: 'checkout.js' } },
    });
    window.dispatchEvent(
      new MessageEvent('message', {
        data: message,
        origin: parentOrigin,
        ports: [channel.port2],
        source: window,
      }),
    );
    await vi.waitFor(() => expect(ready).toBe(true));

    const stopping = agent.stop();
    await expect(stopping).rejects.toMatchObject({
      code: frontsErrorCodes.lifecycleFailed,
      details: { failureCount: 1 },
      phase: 'unmount',
    });
    await expect(agent.stop()).rejects.toMatchObject({ code: frontsErrorCodes.lifecycleFailed });
    expect(unmount).toHaveBeenCalledOnce();
    expect(agent.sessions).toBe(0);
    expect(target.children).toHaveLength(0);
    parentPeer.close();
  });

  it('unmounts an acquired iframe handle that fails contract validation', async () => {
    const parentOrigin = 'https://shell.example.test';
    const channelId = 'invalid-handle-cleanup';
    const unmount = vi.fn();
    const remoteApp = defineApp({
      mount: () => ({ ready: true, unmount }) as never,
    });
    const target = document.createElement('main');
    const agent = createIframeAgent({
      allowedOrigins: [parentOrigin],
      loader: { load: async () => ({ default: remoteApp }) },
      parent: window,
      target,
      window,
    });
    const channel = new MessageChannel();
    const parentPeer = new IframeRpcPeer(channel.port1, { channelId, idPrefix: 'parent' });
    parentPeer.handle('capabilities.negotiate', () => []);
    let fatal: unknown;
    parentPeer.on('fronts.fatal', (error) => {
      fatal = error;
    });
    const ref = normalizeAppRef({ name: 'checkout' });
    const message = createIframeConnectMessage({
      capabilities: [],
      channelId,
      identity,
      props: {},
      ref,
      resolved: { ref, source: { entry: 'checkout.js' } },
    });
    window.dispatchEvent(
      new MessageEvent('message', {
        data: message,
        origin: parentOrigin,
        ports: [channel.port2],
        source: window,
      }),
    );

    await vi.waitFor(() => expect(fatal).toMatchObject({ code: frontsErrorCodes.invalidApp }));
    await agent.stop();

    expect(unmount).toHaveBeenCalledOnce();
    expect(agent.sessions).toBe(0);
    expect(target.children).toHaveLength(0);
    parentPeer.close();
  });

  it('shares application cleanup between iframe RPC unmount and agent stop', async () => {
    const parentOrigin = 'https://shell.example.test';
    const channelId = 'concurrent-session-cleanup';
    let finishCleanup!: () => void;
    const cleanup = new Promise<void>((resolve) => {
      finishCleanup = resolve;
    });
    const unmount = vi.fn(() => cleanup);
    const remoteApp = defineApp({ mount: () => ({ unmount }) });
    const agent = createIframeAgent({
      allowedOrigins: [parentOrigin],
      loader: { load: async () => ({ default: remoteApp }) },
      parent: window,
      target: document.createElement('main'),
      window,
    });
    const channel = new MessageChannel();
    const parentPeer = new IframeRpcPeer(channel.port1, { channelId, idPrefix: 'parent' });
    parentPeer.handle('capabilities.negotiate', () => []);
    let ready = false;
    parentPeer.on('fronts.ready', () => {
      ready = true;
    });
    const ref = normalizeAppRef({ name: 'checkout' });
    const message = createIframeConnectMessage({
      capabilities: [],
      channelId,
      identity,
      props: {},
      ref,
      resolved: { ref, source: { entry: 'checkout.js' } },
    });
    window.dispatchEvent(
      new MessageEvent('message', {
        data: message,
        origin: parentOrigin,
        ports: [channel.port2],
        source: window,
      }),
    );
    await vi.waitFor(() => expect(ready).toBe(true));

    const remoteUnmount = parentPeer.request('lifecycle.unmount', undefined).catch(() => undefined);
    await vi.waitFor(() => expect(unmount).toHaveBeenCalledOnce());
    const stopping = agent.stop();
    await Promise.resolve();
    expect(unmount).toHaveBeenCalledOnce();

    finishCleanup();
    await stopping;
    parentPeer.close();
    await remoteUnmount;
    expect(unmount).toHaveBeenCalledOnce();
    expect(agent.sessions).toBe(0);
  });

  it('enforces a one-time negotiated grant on every host-side service call', async () => {
    const frameOrigin = 'https://frame.example.test';
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    iframe.dataset.frontsChannel = crypto.randomUUID();
    iframe.dataset.frontsFrameLoaded = 'true';
    iframe.dataset.frontsTargetOrigin = frameOrigin;
    const frameWindow = iframe.contentWindow;
    expect(frameWindow).not.toBeNull();
    if (frameWindow === null) {
      throw new Error('Happy DOM did not create an iframe window.');
    }

    const navigation = { go: vi.fn(async () => undefined) };
    const telemetry = { emit: vi.fn(async () => undefined) };
    const resolved: ResolvedApp<Source> = {
      ref: normalizeAppRef({ name: 'checkout' }),
      source: { entry: 'https://cdn.example.test/checkout/mf-manifest.json' },
      version: '2.0.0',
    };
    const proxyLoader = createIframeProxyLoader<Source, Services, Props>({
      capabilities: ['navigation', 'telemetry'],
      handshakeTimeoutMs: 100,
      requestTimeoutMs: 100,
    });
    const proxyApp = getFrontsApp<Props, Services>(
      await proxyLoader.load(resolved, createOperation()),
    );
    let attacker: IframeRpcPeer | undefined;
    let attack = Promise.resolve();

    vi.spyOn(frameWindow, 'postMessage').mockImplementation(((...args: unknown[]) => {
      const [message, , transfer] = args;
      const connect = message as { capabilities: readonly string[]; channelId: string };
      expect(connect.capabilities).toEqual(['navigation']);
      const port = Array.isArray(transfer) ? (transfer[0] as MessagePort | undefined) : undefined;
      if (port === undefined) {
        throw new Error('Iframe proxy did not transfer an RPC port.');
      }
      const malicious = new IframeRpcPeer(port, {
        channelId: connect.channelId,
        idPrefix: 'malicious-agent',
        requestTimeoutMs: 100,
      });
      attacker = malicious;
      malicious.handle('lifecycle.unmount', () => undefined);
      attack = (async () => {
        await expect(
          malicious.request('service.call', {
            args: ['/before-negotiation'],
            capability: 'navigation',
            method: 'go',
          }),
        ).rejects.toMatchObject({ code: frontsErrorCodes.capabilityDenied });

        await expect(malicious.request('capabilities.negotiate', ['navigation'])).resolves.toEqual([
          'navigation',
        ]);
        await expect(
          malicious.request('capabilities.negotiate', ['navigation']),
        ).rejects.toMatchObject({ code: frontsErrorCodes.iframeProtocol });
        await expect(
          malicious.request('service.call', {
            args: ['forged'],
            capability: 'telemetry',
            method: 'emit',
          }),
        ).rejects.toMatchObject({ code: frontsErrorCodes.capabilityDenied });
        await expect(
          malicious.request('service.call', {
            args: ['/granted'],
            capability: 'navigation',
            method: 'go',
          }),
        ).resolves.toBeUndefined();
        malicious.notify('fronts.ready');
      })();
    }) as typeof frameWindow.postMessage);

    const handle = await proxyApp.mount({
      identity,
      props: { value: 'malicious frame' },
      services: { navigation } as unknown as Services,
      signal: new AbortController().signal,
      target: iframe,
    });
    await vi.waitFor(() => expect(attacker).toBeDefined());
    await Promise.all([handle.ready, attack]);

    expect(navigation.go).toHaveBeenCalledOnce();
    expect(navigation.go).toHaveBeenCalledWith('/granted');
    expect(telemetry.emit).not.toHaveBeenCalled();
    await handle.unmount();
    attacker?.close();
    iframe.remove();
  });

  it('cancels pending iframe lifecycle calls with the application lifetime', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    iframe.dataset.frontsChannel = crypto.randomUUID();
    iframe.dataset.frontsFrameLoaded = 'true';
    iframe.dataset.frontsTargetOrigin = 'https://frame.example.test';
    const frameWindow = iframe.contentWindow;
    expect(frameWindow).not.toBeNull();
    if (frameWindow === null) {
      throw new Error('Happy DOM did not create an iframe window.');
    }

    let remote: IframeRpcPeer | undefined;
    let updateSignal: AbortSignal | undefined;
    vi.spyOn(frameWindow, 'postMessage').mockImplementation(((...args: unknown[]) => {
      const [message, , transfer] = args;
      const connect = message as { channelId: string };
      const port = Array.isArray(transfer) ? (transfer[0] as MessagePort | undefined) : undefined;
      if (port === undefined) {
        throw new Error('Iframe proxy did not transfer an RPC port.');
      }
      remote = new IframeRpcPeer(port, {
        channelId: connect.channelId,
        idPrefix: 'cancellable-agent',
        requestTimeoutMs: 0,
      });
      remote.handle('lifecycle.update', (_params, context) => {
        updateSignal = context.signal;
        return new Promise(() => undefined);
      });
      remote.handle('lifecycle.unmount', () => undefined);
      void remote.request('capabilities.negotiate', []).then(() => remote?.notify('fronts.ready'));
    }) as typeof frameWindow.postMessage);

    const resolved: ResolvedApp<Source> = {
      ref: normalizeAppRef({ name: 'checkout' }),
      source: { entry: 'https://cdn.example.test/checkout/mf-manifest.json' },
    };
    const proxyApp = getFrontsApp<Props, object>(
      await createIframeProxyLoader<Source, object, Props>({
        handshakeTimeoutMs: 100,
        requestTimeoutMs: 0,
      }).load(resolved, createOperation()),
    );
    const controller = new AbortController();
    const handle = await proxyApp.mount({
      identity,
      props: { value: 'cancellable' },
      services: {},
      signal: controller.signal,
      target: iframe,
    });
    await handle.ready;

    const update = handle.update?.({ value: 'pending' });
    await vi.waitFor(() => expect(updateSignal).toBeDefined());
    controller.abort('application lifetime ended');

    await expect(update).rejects.toMatchObject({ code: frontsErrorCodes.aborted });
    await vi.waitFor(() => expect(updateSignal?.aborted).toBe(true));
    await handle.unmount();
    remote?.close();
    iframe.remove();
  });

  it('treats proxy capabilities as a negotiable maximum during host authorization', async () => {
    const resolved: ResolvedApp<Source> = {
      ref: normalizeAppRef({ name: 'checkout' }),
      source: { entry: 'https://cdn.example.test/checkout/mf-manifest.json' },
      version: '2.0.0',
    };
    const navigation = { go: vi.fn(async () => undefined) };
    const telemetry = { emit: vi.fn(async () => undefined) };
    const disposeServices = vi.fn();
    const prepare = vi.fn(() => {
      throw new Error('stop after authorization');
    });
    const createServices = vi.fn(() => ({
      dispose: disposeServices,
      services: { navigation, telemetry },
    }));
    const capabilityPolicy = vi.fn(
      ({ capability }: { readonly capability: keyof Services }) => capability === 'navigation',
    );
    const host = createFrontsHost<Source, Services>({
      capabilityPolicy,
      containers: [{ prepare, type: 'dom' }],
      createServices,
      loader: createIframeProxyLoader<Source, Services, Props>({
        capabilities: ['navigation', 'telemetry'],
      }),
      resolver: { resolve: () => resolved },
    });

    await expect(
      host.mount({
        props: { value: 'host scoped frame' },
        ref: { name: 'checkout' },
        target: document.createElement('main'),
      }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.containerFailed });

    expect(createServices).toHaveBeenCalledWith(
      expect.objectContaining({ capabilities: ['navigation', 'telemetry'] }),
    );
    expect(capabilityPolicy.mock.calls.map(([context]) => context.capability)).toEqual([
      'navigation',
      'telemetry',
    ]);
    expect(prepare).toHaveBeenCalledOnce();
    expect(disposeServices).toHaveBeenCalledOnce();
    expect(host.audit().idle).toBe(true);
  });

  it('loads, mounts, and reliably tears down the real application inside an iframe realm', async () => {
    const parentOrigin = 'https://shell.example.test';
    const frameOrigin = 'https://frame.example.test';
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    iframe.dataset.frontsChannel = crypto.randomUUID();
    iframe.dataset.frontsFrameLoaded = 'true';
    iframe.dataset.frontsTargetOrigin = frameOrigin;
    const frameWindow = iframe.contentWindow;
    expect(frameWindow).not.toBeNull();
    if (frameWindow === null) {
      throw new Error('Happy DOM did not create an iframe window.');
    }

    const navigation = { go: vi.fn(async () => undefined) };
    const telemetry = { emit: vi.fn(async () => undefined) };
    const remoteUnmount = vi.fn(async () => undefined);
    const remoteUpdate = vi.fn(async () => undefined);
    const remoteApp = defineApp<Props, Services>({
      capabilities: ['navigation'],
      async mount({ props, services, target }) {
        expect(Object.keys(services)).toEqual(['navigation']);
        expect('telemetry' in services).toBe(false);
        target.append(document.createTextNode(props.value));
        await services.navigation.go('/ready');
        return { unmount: remoteUnmount, update: remoteUpdate };
      },
    });
    const frameLoad = vi.fn(async () => ({ default: remoteApp }));
    const frameLoader: AppLoader<Source> = { load: frameLoad };
    const frameTarget = frameWindow.document.createElement('main');
    frameWindow.document.body.append(frameTarget);
    const agent = createIframeAgent({
      allowedOrigins: [parentOrigin],
      loader: frameLoader,
      parent: window,
      target: frameTarget,
      window: frameWindow,
    });
    const FrameMessageEvent = Reflect.get(frameWindow, 'MessageEvent') as typeof MessageEvent;

    vi.spyOn(frameWindow, 'postMessage').mockImplementation(((...args: unknown[]) => {
      const [message, , transfer] = args;
      frameWindow.dispatchEvent(
        new FrameMessageEvent('message', {
          data: message,
          origin: parentOrigin,
          ports: (Array.isArray(transfer) ? transfer : []) as MessagePort[],
          source: window,
        }),
      );
    }) as typeof frameWindow.postMessage);

    const resolved: ResolvedApp<Source> = {
      ref: normalizeAppRef({ name: 'checkout' }),
      source: { entry: 'https://cdn.example.test/checkout/mf-manifest.json' },
      version: '2.0.0',
    };
    const proxyLoader = createIframeProxyLoader<Source, Services, Props>({
      capabilities: ['navigation', 'telemetry'],
      handshakeTimeoutMs: 100,
      requestTimeoutMs: 100,
    });
    const proxyOperation = createOperation();
    const proxyApp = getFrontsApp<Props, Services>(
      await proxyLoader.load(resolved, proxyOperation),
    );
    const controller = new AbortController();
    const handle = await proxyApp.mount({
      identity,
      props: { value: 'Checkout frame' },
      services: { navigation, telemetry },
      signal: controller.signal,
      target: iframe,
    });
    assertAppHandle<Props>(handle);
    await vi.waitFor(() => expect(agent.sessions).toBe(1), { timeout: 50 });
    await handle.ready;

    expect(agent.sessions).toBe(1);
    expect(frameLoad).toHaveBeenCalledOnce();
    expect(navigation.go).toHaveBeenCalledWith('/ready');
    expect(telemetry.emit).not.toHaveBeenCalled();
    expect(frameTarget.textContent).toContain('Checkout frame');

    await handle.update?.({ value: 'next' });
    expect(remoteUpdate).toHaveBeenCalledWith({ value: 'next' });
    await handle.unmount();
    expect(remoteUnmount).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(agent.sessions).toBe(0));

    const deniedMount = vi.fn(() => ({ unmount: vi.fn() }));
    const deniedRemoteApp = defineApp<Props, Services>({
      capabilities: ['telemetry'],
      mount: deniedMount,
    });
    frameLoad.mockResolvedValueOnce({ default: deniedRemoteApp });
    const restrictedProxyLoader = createIframeProxyLoader<Source, Services, Props>({
      capabilities: ['navigation'],
      handshakeTimeoutMs: 100,
      requestTimeoutMs: 100,
    });
    const restrictedProxyApp = getFrontsApp<Props, Services>(
      await restrictedProxyLoader.load(resolved, proxyOperation),
    );
    iframe.dataset.frontsChannel = crypto.randomUUID();
    const deniedHandle = await restrictedProxyApp.mount({
      identity: { ...identity, instanceId: 'checkout-frame-denied' },
      props: { value: 'Denied frame' },
      services: { navigation, telemetry },
      signal: new AbortController().signal,
      target: iframe,
    });
    await expect(deniedHandle.ready).rejects.toMatchObject({
      details: { remoteCode: frontsErrorCodes.capabilityDenied },
    });
    expect(deniedMount).not.toHaveBeenCalled();
    await deniedHandle.unmount();
    await vi.waitFor(() => expect(agent.sessions).toBe(0));

    iframe.dataset.frontsChannel = crypto.randomUUID();
    remoteUnmount.mockRejectedValueOnce(new Error('remote cleanup failed'));
    const failingHandle = await proxyApp.mount({
      identity: { ...identity, instanceId: 'checkout-frame-failing' },
      props: { value: 'Failing cleanup frame' },
      services: { navigation, telemetry },
      signal: new AbortController().signal,
      target: iframe,
    });
    await failingHandle.ready;
    await expect(failingHandle.unmount()).rejects.toThrow('remote cleanup failed');
    expect(remoteUnmount).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(agent.sessions).toBe(0));
    expect(frameTarget.children).toHaveLength(0);

    await agent.stop();
    iframe.remove();
  });
});
