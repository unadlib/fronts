import { describe, expect, it, vi } from 'vitest';

import {
  createFrontsHost,
  defineApp,
  frontsErrorCodes,
  type AppLoader,
  type AppResolver,
  type MountContext,
} from '../src/index.js';

interface Props {
  readonly label: string;
}

interface Source {
  readonly release: 'v1' | 'v2';
}

interface Deferred {
  readonly promise: Promise<void>;
  readonly reject: (error: unknown) => void;
  readonly resolve: () => void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createReplacementHarness(options: {
  readonly oldUnmount?: () => Promise<void> | void;
  readonly nextReady?: Promise<void>;
}) {
  const oldUnmount = vi.fn(options.oldUnmount ?? (() => undefined));
  const nextUnmount = vi.fn();
  const oldMount = vi.fn(({ target, props }: MountContext<Props, object>) => {
    target.textContent = `old:${props.label}`;
    return { unmount: oldUnmount };
  });
  const nextMount = vi.fn(({ target, props }: MountContext<Props, object>) => {
    target.textContent = `new:${props.label}`;
    return {
      ready: options.nextReady ?? Promise.resolve(),
      unmount: nextUnmount,
    };
  });
  const oldApp = defineApp<Props>({ mount: oldMount });
  const nextApp = defineApp<Props>({ mount: nextMount });
  const resolver: AppResolver<Source> = {
    resolve(ref) {
      const release: Source['release'] = ref.range === '2' ? 'v2' : 'v1';
      return { ref, source: { release }, version: release === 'v2' ? '2.0.0' : '1.0.0' };
    },
  };
  const loader: AppLoader<Source> = {
    load: vi.fn((resolved) => ({
      default: resolved.source.release === 'v2' ? nextApp : oldApp,
    })),
  };
  const host = createFrontsHost({ loader, resolver });

  return { host, loader, nextMount, nextUnmount, oldMount, oldUnmount };
}

describe('ready-first application replacement', () => {
  it('keeps the old release live until the replacement is ready and then commits it', async () => {
    const readiness = deferred();
    const { host, loader, nextMount, nextUnmount, oldUnmount } = createReplacementHarness({
      nextReady: readiness.promise,
    });
    const target = document.createElement('main');
    const current = await host.mount({
      instanceId: 'checkout-current',
      props: { label: 'stable' },
      ref: { name: 'checkout', range: '1' },
      target,
    });

    const replacement = host.replace('checkout-current', {
      instanceId: 'checkout-next',
      operationId: 'checkout-replacement',
      props: { label: 'canary' },
      ref: { name: 'checkout', range: '2' },
      target,
      traceId: 'checkout-replacement-trace',
    });
    await vi.waitFor(() => expect(nextMount).toHaveBeenCalledOnce());

    const staging = target.querySelector<HTMLElement>('[data-fronts-deployment="staging"]');
    expect(staging?.hidden).toBe(true);
    expect(current.state).toBe('ready');
    expect(oldUnmount).not.toHaveBeenCalled();
    expect(target.textContent).toContain('old:stable');

    readiness.resolve();
    const result = await replacement;
    expect(loader.load).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: { release: 'v2' } }),
      expect.objectContaining({
        intent: 'replace',
        operationId: 'checkout-replacement',
        traceId: 'checkout-replacement-trace',
      }),
    );
    expect(result.application.identity).toMatchObject({
      instanceId: 'checkout-next',
      version: '2.0.0',
    });
    expect(result.previous).toEqual(current.identity);
    expect(result.previousCleanupError).toBeUndefined();
    expect(current.state).toBe('destroyed');
    expect(oldUnmount).toHaveBeenCalledOnce();
    expect(target.textContent).not.toContain('old:stable');
    expect(target.textContent).toContain('new:canary');
    expect(target.querySelector('[data-fronts-deployment="committed"]')).not.toBeNull();

    await result.application.unmount();
    expect(nextUnmount).toHaveBeenCalledOnce();
    expect(target.children).toHaveLength(0);
  });

  it('rolls back the staging slot and leaves the old release untouched on failure', async () => {
    const failure = new Error('canary failed its readiness check');
    const readiness = deferred();
    const { host, nextMount, oldUnmount } = createReplacementHarness({
      nextReady: readiness.promise,
    });
    const target = document.createElement('main');
    const current = await host.mount({
      instanceId: 'checkout-current',
      props: { label: 'stable' },
      ref: { name: 'checkout', range: '1' },
      target,
    });

    const replacement = host.replace('checkout-current', {
      instanceId: 'checkout-failed-canary',
      props: { label: 'canary' },
      ref: { name: 'checkout', range: '2' },
      target,
    });
    void replacement.catch(() => undefined);
    await vi.waitFor(() => expect(nextMount).toHaveBeenCalledOnce());
    readiness.reject(failure);
    await expect(replacement).rejects.toMatchObject({
      code: frontsErrorCodes.mountFailed,
      phase: 'ready',
    });

    expect(current.state).toBe('ready');
    expect(host.get('checkout-current')).toBe(current);
    expect(oldUnmount).not.toHaveBeenCalled();
    expect(target.textContent).toBe('old:stable');
    expect(target.querySelector('[data-fronts-deployment]')).toBeNull();
  });

  it('waits for replacement rollback before host disposal becomes idle', async () => {
    const readiness = deferred();
    const { host, nextMount } = createReplacementHarness({ nextReady: readiness.promise });
    const target = document.createElement('main');
    await host.mount({
      instanceId: 'checkout-current',
      props: { label: 'stable' },
      ref: { name: 'checkout', range: '1' },
      target,
    });
    const replacement = host.replace('checkout-current', {
      instanceId: 'checkout-next',
      props: { label: 'canary' },
      ref: { name: 'checkout', range: '2' },
      target,
    });
    void replacement.catch(() => undefined);
    await vi.waitFor(() => expect(nextMount).toHaveBeenCalledOnce());

    const disposal = host.dispose();
    await expect(replacement).rejects.toMatchObject({ code: frontsErrorCodes.aborted });
    await expect(disposal).resolves.toBeUndefined();

    expect(target.children).toHaveLength(0);
    expect(host.audit()).toMatchObject({
      idle: true,
      replacementTransactions: [],
    });
  });

  it('rejects concurrent replacement transactions for the same instance', async () => {
    const readiness = deferred();
    const { host, nextMount } = createReplacementHarness({ nextReady: readiness.promise });
    const target = document.createElement('main');
    await host.mount({
      instanceId: 'checkout-current',
      props: { label: 'stable' },
      ref: { name: 'checkout', range: '1' },
      target,
    });
    const first = host.replace('checkout-current', {
      instanceId: 'checkout-next',
      props: { label: 'canary' },
      ref: { name: 'checkout', range: '2' },
      target,
    });
    await vi.waitFor(() => expect(nextMount).toHaveBeenCalledOnce());

    await expect(
      host.replace('checkout-current', {
        instanceId: 'checkout-other',
        props: { label: 'other' },
        ref: { name: 'checkout', range: '2' },
        target,
      }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.invalidState });

    readiness.resolve();
    const result = await first;
    await result.application.unmount();
  });

  it('releases the replacement transaction when staging slot creation fails', async () => {
    const { host } = createReplacementHarness({});
    const target = document.createElement('main');
    const current = await host.mount({
      instanceId: 'checkout-current',
      props: { label: 'stable' },
      ref: { name: 'checkout', range: '1' },
      target,
    });
    const brokenTarget = document.createElement('main');
    vi.spyOn(brokenTarget, 'append').mockImplementation(() => {
      throw new Error('staging target rejected the slot');
    });

    await expect(
      host.replace('checkout-current', {
        instanceId: 'checkout-next',
        props: { label: 'canary' },
        ref: { name: 'checkout', range: '2' },
        target: brokenTarget,
      }),
    ).rejects.toMatchObject({
      code: frontsErrorCodes.containerFailed,
      phase: 'container',
    });
    expect(host.audit().replacementTransactions).toEqual([]);
    expect(host.get('checkout-current')).toBe(current);
    expect(brokenTarget.children).toHaveLength(0);

    await current.unmount();
    expect(host.audit().idle).toBe(true);
  });

  it('rolls back the replacement when staging commit fails', async () => {
    const { host, nextUnmount, oldUnmount } = createReplacementHarness({});
    const target = document.createElement('main');
    const current = await host.mount({
      instanceId: 'checkout-current',
      props: { label: 'stable' },
      ref: { name: 'checkout', range: '1' },
      target,
    });
    const append = target.append.bind(target);
    vi.spyOn(target, 'append').mockImplementation((...nodes) => {
      append(...nodes);
      const slot = nodes[0];
      if (slot instanceof HTMLElement) {
        vi.spyOn(slot, 'removeAttribute').mockImplementation(() => {
          throw new Error('staging slot rejected commit');
        });
      }
    });

    await expect(
      host.replace('checkout-current', {
        instanceId: 'checkout-next',
        props: { label: 'canary' },
        ref: { name: 'checkout', range: '2' },
        target,
      }),
    ).rejects.toMatchObject({
      code: frontsErrorCodes.containerFailed,
      phase: 'container',
    });

    expect(current.state).toBe('ready');
    expect(host.get('checkout-current')).toBe(current);
    expect(host.get('checkout-next')).toBeUndefined();
    expect(oldUnmount).not.toHaveBeenCalled();
    expect(nextUnmount).toHaveBeenCalledOnce();
    expect(target.textContent).toBe('old:stable');
    expect(target.querySelector('[data-fronts-deployment]')).toBeNull();
    expect(host.audit().replacementTransactions).toEqual([]);

    await current.unmount();
    expect(host.audit().idle).toBe(true);
  });

  it('commits a ready replacement even when previous-version cleanup reports an error', async () => {
    const cleanupFailure = new Error('old framework root would not unmount');
    const { host } = createReplacementHarness({
      oldUnmount: () => {
        throw cleanupFailure;
      },
    });
    const target = document.createElement('main');
    await host.mount({
      instanceId: 'checkout-current',
      props: { label: 'stable' },
      ref: { name: 'checkout', range: '1' },
      target,
    });

    const result = await host.replace('checkout-current', {
      instanceId: 'checkout-next',
      props: { label: 'canary' },
      ref: { name: 'checkout', range: '2' },
      target,
    });

    expect(result.application.state).toBe('ready');
    expect(result.previousCleanupError).toMatchObject({
      code: frontsErrorCodes.lifecycleFailed,
      phase: 'unmount',
    });
    expect(target.textContent).toContain('new:canary');
    await result.application.unmount();
  });
});
