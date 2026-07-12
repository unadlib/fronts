import { describe, expect, it, vi } from 'vitest';

import {
  assertAppHandle,
  defineApp,
  frontsErrorCodes,
  getFrontsApp,
  normalizeAppRef,
  type AppLoader,
  type ApplicationIdentity,
  type FrontsError,
  type ResolvedApp,
} from '../src/index.js';
import {
  IframeRpcPeer,
  createIframeAgent,
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
}

const identity: ApplicationIdentity = {
  instanceId: 'checkout-frame',
  name: 'checkout',
  version: '2.0.0',
};

describe('secure iframe execution', () => {
  it('creates an origin-bound iframe container with an isolated channel', async () => {
    const target = document.createElement('main');
    const prepared = await createIframeContainer().prepare({
      identity,
      request: {
        sandbox: ['allow-scripts'],
        src: 'https://frame.example.test/app',
        targetOrigin: 'https://frame.example.test',
        title: 'Checkout',
        type: 'iframe',
      },
      signal: new AbortController().signal,
      target,
    });
    const iframe = prepared.element as HTMLIFrameElement;

    expect(iframe.src).toBe('https://frame.example.test/app');
    expect(iframe.title).toBe('Checkout');
    expect(iframe.sandbox.contains('allow-scripts')).toBe(true);
    expect(iframe.sandbox.contains('allow-same-origin')).toBe(false);
    expect(iframe.dataset.frontsTargetOrigin).toBe('https://frame.example.test');
    expect(iframe.dataset.frontsChannel).toMatch(/^[\da-f-]{20,}$/i);
    expect(prepared.target).toBe(iframe);

    iframe.dispatchEvent(new Event('load'));
    expect(iframe.dataset.frontsFrameLoaded).toBe('true');
    await prepared.dispose();
    expect(target.children).toHaveLength(0);
  });

  it('does not grant same-origin authority by default', async () => {
    const prepared = await createIframeContainer().prepare({
      identity,
      request: {
        src: 'https://frame.example.test/app',
        targetOrigin: 'https://frame.example.test',
        title: 'Checkout',
        type: 'iframe',
      },
      signal: new AbortController().signal,
      target: document.createElement('main'),
    });
    const iframe = prepared.element as HTMLIFrameElement;

    expect(iframe.sandbox.contains('allow-scripts')).toBe(true);
    expect(iframe.sandbox.contains('allow-same-origin')).toBe(false);
    await prepared.dispose();
  });

  it('forbids wildcard and mismatched iframe origins', () => {
    const target = document.createElement('main');
    const prepare = (targetOrigin: string) =>
      createIframeContainer().prepare({
        identity,
        request: {
          src: 'https://frame.example.test/app',
          targetOrigin,
          title: 'Checkout',
          type: 'iframe',
        },
        signal: new AbortController().signal,
        target,
      });

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
    const remoteUnmount = vi.fn(async () => undefined);
    const remoteUpdate = vi.fn(async () => undefined);
    const remoteApp = defineApp<Props, Services>({
      capabilities: ['navigation'],
      async mount({ props, services, target }) {
        target.append(document.createTextNode(props.value));
        await services.navigation.go('/ready');
        return { unmount: remoteUnmount, update: remoteUpdate };
      },
    });
    const frameLoader: AppLoader<Source> = {
      load: vi.fn(async () => ({ default: remoteApp })),
    };
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
      capabilities: ['navigation'],
      handshakeTimeoutMs: 100,
      requestTimeoutMs: 100,
    });
    const proxyApp = getFrontsApp<Props, Services>(
      await proxyLoader.load(resolved, { signal: new AbortController().signal }),
    );
    const controller = new AbortController();
    const handle = await proxyApp.mount({
      identity,
      props: { value: 'Checkout frame' },
      services: { navigation },
      signal: controller.signal,
      target: iframe,
    });
    assertAppHandle<Props>(handle);
    await vi.waitFor(() => expect(agent.sessions).toBe(1), { timeout: 50 });
    await handle.ready;

    expect(agent.sessions).toBe(1);
    expect(frameLoader.load).toHaveBeenCalledOnce();
    expect(navigation.go).toHaveBeenCalledWith('/ready');
    expect(frameTarget.textContent).toContain('Checkout frame');

    await handle.update?.({ value: 'next' });
    expect(remoteUpdate).toHaveBeenCalledWith({ value: 'next' });
    await handle.unmount();
    expect(remoteUnmount).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(agent.sessions).toBe(0));

    iframe.dataset.frontsChannel = crypto.randomUUID();
    remoteUnmount.mockRejectedValueOnce(new Error('remote cleanup failed'));
    const failingHandle = await proxyApp.mount({
      identity: { ...identity, instanceId: 'checkout-frame-failing' },
      props: { value: 'Failing cleanup frame' },
      services: { navigation },
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
