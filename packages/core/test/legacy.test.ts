import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApplicationIdentity, ResolvedApp } from '../src/index.js';
import { FrontsError, frontsErrorCodes, normalizeAppRef } from '../src/index.js';
import {
  adaptLegacyFrontsApp,
  adaptLegacyFrontsModule,
  createLegacyScriptLoader,
  type LegacyFrontsModule,
  type LegacyScriptLoader,
  type LegacyScriptSource,
} from '../src/legacy/index.js';

interface Props {
  readonly value: string;
}

interface LegacyWindowState {
  __FRONTS__DYNAMIC__IMPORT__?: boolean;
  __FRONTS__DYNAMIC__MODULES__?: Record<string, LegacyFrontsModule>;
}

const identity: ApplicationIdentity = {
  instanceId: 'legacy-app-1',
  name: 'legacy-app',
  version: '0.1.1',
};

const loaders = new Set<LegacyScriptLoader>();
const appendedScripts: HTMLScriptElement[] = [];

function globals(): Window & LegacyWindowState {
  return window as Window & LegacyWindowState;
}

function resolved(source: LegacyScriptSource, name = 'checkout'): ResolvedApp<LegacyScriptSource> {
  return {
    ref: normalizeAppRef({ name }),
    source,
    version: '0.1.1',
  };
}

function createLoader(
  options: Parameters<typeof createLegacyScriptLoader>[0] = {},
): LegacyScriptLoader {
  const loader = createLegacyScriptLoader(options);
  loaders.add(loader);
  return loader;
}

function registerAndLoad(name: string, render: LegacyFrontsModule['default']): HTMLScriptElement {
  const script = appendedScripts.at(-1);
  if (script === undefined) {
    throw new Error('Expected the legacy loader to append a script element.');
  }
  const modules = (globals().__FRONTS__DYNAMIC__MODULES__ ??= {});
  modules[name] = { default: render };
  script.dispatchEvent(new Event('load'));
  return script;
}

beforeEach(() => {
  vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
    for (const node of nodes) {
      if (node instanceof HTMLScriptElement) {
        appendedScripts.push(node);
      }
    }
  });
});

afterEach(() => {
  for (const loader of loaders) {
    loader.dispose();
  }
  loaders.clear();
  delete globals().__FRONTS__DYNAMIC__IMPORT__;
  delete globals().__FRONTS__DYNAMIC__MODULES__;
  appendedScripts.length = 0;
  vi.useRealTimers();
});

describe('Fronts 0.x application adapter', () => {
  it('maps legacy render, update-by-remount and cleanup onto the 2.0 lifecycle', async () => {
    const cleanup = vi.fn();
    const render = vi.fn((target: HTMLElement | null, props?: Readonly<Props>) => {
      if (target !== null) {
        target.textContent = props?.value ?? '';
      }
      return cleanup;
    });
    const app = adaptLegacyFrontsApp<Props>(render, { name: 'legacy-app' });
    const target = document.createElement('div');
    const handle = await app.mount({
      identity,
      props: { value: 'first' },
      services: {},
      signal: new AbortController().signal,
      target,
    });

    await handle.ready;
    expect(target.textContent).toBe('first');

    await handle.update?.({ value: 'second' });
    expect(cleanup).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledTimes(2);
    expect(target.textContent).toBe('second');

    await handle.unmount();
    await handle.unmount();
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(target.textContent).toBe('');
  });

  it('uses an owned HTML element for Shadow DOM and removes it on unmount', async () => {
    const render = vi.fn((target: HTMLElement | null) => {
      target?.append('legacy shadow');
    });
    const app = adaptLegacyFrontsApp<Record<string, never>>(render);
    const target = document.createElement('div').attachShadow({ mode: 'open' });
    const handle = await app.mount({
      identity,
      props: {},
      services: {},
      signal: new AbortController().signal,
      target,
    });

    expect(target.textContent).toBe('legacy shadow');
    expect(target.querySelector('[data-fronts-legacy-target]')).not.toBeNull();
    await handle.unmount();
    expect(target.childElementCount).toBe(0);
  });

  it('can reject updates when remount semantics are unsafe for an old application', async () => {
    const app = adaptLegacyFrontsApp<Props>(() => undefined, {
      updateMode: 'reject',
    });
    const handle = await app.mount({
      identity,
      props: { value: 'first' },
      services: {},
      signal: new AbortController().signal,
      target: document.createElement('div'),
    });

    await expect(handle.update?.({ value: 'second' })).rejects.toMatchObject({
      code: frontsErrorCodes.lifecycleFailed,
      phase: 'update',
    });
    await handle.unmount();
  });

  it('validates the v0 default export before adapting it', () => {
    expect(() => adaptLegacyFrontsModule({ default: 'not a render function' })).toThrowError(
      FrontsError,
    );
  });
});

describe('Fronts 0.x script loader', () => {
  it('loads and adapts an explicitly registered same-origin v0 script', async () => {
    const render = vi.fn((target: HTMLElement | null) => {
      target?.append('legacy checkout');
    });
    const loader = createLoader();
    const pending = loader.load(resolved({ url: '/legacy-checkout.js' }), {
      signal: new AbortController().signal,
    });
    const script = registerAndLoad('checkout', render);
    const app = await pending;

    expect(script.src).toBe(new URL('/legacy-checkout.js', document.baseURI).href);
    expect(script.isConnected).toBe(false);
    expect(globals().__FRONTS__DYNAMIC__IMPORT__).toBe(true);

    const target = document.createElement('div');
    const handle = await app.mount({
      identity,
      props: {},
      services: {},
      signal: new AbortController().signal,
      target,
    });
    expect(target.textContent).toBe('legacy checkout');
    await handle.unmount();

    loader.dispose();
    expect(globals().__FRONTS__DYNAMIC__IMPORT__).toBeUndefined();
    expect(globals().__FRONTS__DYNAMIC__MODULES__).toBeUndefined();
  });

  it('deduplicates concurrent requests for the same global and script URL', async () => {
    const loader = createLoader();
    const source = resolved({ url: '/legacy-checkout.js' });
    const first = loader.load(source, { signal: new AbortController().signal });
    const second = loader.load(source, { signal: new AbortController().signal });

    expect(appendedScripts).toHaveLength(1);
    registerAndLoad('checkout', () => undefined);
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it('enforces an origin allowlist and SRI for cross-origin legacy code', async () => {
    const loader = createLoader({
      allowedOrigins: [new URL(document.baseURI).origin, 'https://cdn.example'],
    });

    await expect(
      loader.load(resolved({ url: 'https://evil.example/app.js' }), {
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.loadFailed });
    await expect(
      loader.load(resolved({ url: 'https://cdn.example/app.js' }), {
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('requires a Subresource Integrity value');

    const pending = loader.load(
      resolved({
        crossOrigin: 'anonymous',
        integrity: 'sha384-fronts',
        url: 'https://cdn.example/app.js',
      }),
      { signal: new AbortController().signal },
    );
    const script = appendedScripts.at(-1);
    expect(script).toMatchObject({
      crossOrigin: 'anonymous',
      integrity: 'sha384-fronts',
    });
    registerAndLoad('checkout', () => undefined);
    await pending;
  });

  it('rejects cancellation, missing registration and load timeouts with structured errors', async () => {
    const aborted = new AbortController();
    aborted.abort('navigation changed');
    const loader = createLoader({ timeoutMs: 20 });

    await expect(
      loader.load(resolved({ url: '/aborted.js' }), { signal: aborted.signal }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.aborted, phase: 'load' });

    const missing = loader.load(resolved({ globalName: 'missing', url: '/missing.js' }), {
      signal: new AbortController().signal,
    });
    appendedScripts.at(-1)?.dispatchEvent(new Event('load'));
    await expect(missing).rejects.toThrow('did not register application "missing"');

    vi.useFakeTimers();
    const timeout = loader.load(resolved({ globalName: 'slow', url: '/slow.js' }), {
      signal: new AbortController().signal,
    });
    void timeout.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(20);
    await expect(timeout).rejects.toMatchObject({ code: frontsErrorCodes.loadFailed });
  });

  it('prevents ambiguous same-global version replacement in one JavaScript realm', async () => {
    const loader = createLoader();
    const preload = loader.preload?.(resolved({ url: '/checkout-v1.js' }), {
      signal: new AbortController().signal,
    });
    registerAndLoad('checkout', () => undefined);
    await preload;

    await expect(
      loader.load(resolved({ url: '/checkout-v2.js' }), {
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('already bound to a different script URL');
  });

  it('restores pre-existing v0 globals without deleting registrations it did not own', async () => {
    const existing: LegacyFrontsModule = { default: () => undefined };
    globals().__FRONTS__DYNAMIC__IMPORT__ = false;
    globals().__FRONTS__DYNAMIC__MODULES__ = { existing };
    const loader = createLoader();
    const pending = loader.load(resolved({ url: '/checkout.js' }), {
      signal: new AbortController().signal,
    });
    registerAndLoad('checkout', () => undefined);
    await pending;

    loader.dispose();
    expect(globals().__FRONTS__DYNAMIC__IMPORT__).toBe(false);
    expect(globals().__FRONTS__DYNAMIC__MODULES__).toEqual({ existing });
  });
});
