import { describe, expect, it, vi } from 'vitest';

import {
  MemoryResolutionCache,
  createCachedResolver,
  createFallbackResolver,
  createRegistryResolver,
  createStaticResolver,
  frontsErrorCodes,
  normalizeAppRef,
  type AppResolver,
  type DetachedHostOperationContext,
  type FrontsError,
  type ResolveContext,
} from '../src/index.js';

const signal = new AbortController().signal;
const operation: DetachedHostOperationContext = {
  hostId: 'resolver-test-host',
  intent: 'resolve',
  operationId: 'resolver-test-operation',
  signal,
  traceId: 'resolver-test-trace',
};
const context: ResolveContext = {
  environment: 'production',
  operation,
  signal,
  tenant: 'acme',
};

describe('application resolution', () => {
  it('normalizes and validates application references', () => {
    expect(normalizeAppRef({ name: ' checkout ', range: ' ^2 ' })).toEqual({
      expose: './application',
      name: 'checkout',
      range: '^2',
    });

    expect(() => normalizeAppRef({ expose: 'app', name: 'checkout' })).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.resolutionFailed,
      }),
    );
    expect(() => normalizeAppRef({ name: 'check out' })).toThrowError();
  });

  it('selects static releases using application and rollout context', async () => {
    const resolver = createStaticResolver([
      {
        match: { channel: 'canary', name: 'checkout', tenant: 'acme' },
        resolve: { source: { entry: 'canary.json' }, version: '2.1.0' },
      },
      {
        match: { name: 'checkout' },
        resolve: { source: { entry: 'stable.json' }, version: '2.0.0' },
      },
    ]);

    const ref = normalizeAppRef({ channel: 'canary', name: 'checkout' });
    expect(await resolver.resolve(ref, context)).toEqual({
      ref,
      source: { entry: 'canary.json' },
      version: '2.1.0',
    });
  });

  it('sends release policy fields to a registry without leaking metadata', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ source: { entry: 'checkout.json' }, version: '2.2.0' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const resolver = createRegistryResolver<{ entry: string }>({
      endpoint: 'https://registry.example.test/resolve',
      fetch: request,
      headers: { authorization: 'Bearer token' },
    });
    const ref = normalizeAppRef({ channel: 'stable', name: 'checkout', range: '^2' });

    await expect(
      resolver.resolve(ref, { ...context, cohort: 'beta', metadata: { secret: true } }),
    ).resolves.toEqual({
      ref,
      source: { entry: 'checkout.json' },
      version: '2.2.0',
    });

    const [url, init] = request.mock.calls[0] ?? [];
    expect(String(url)).toContain('name=checkout');
    expect(String(url)).toContain('range=%5E2');
    expect(String(url)).toContain('cohort=beta');
    expect(String(url)).not.toContain('secret');
    expect(init).toMatchObject({ method: 'GET' });
  });

  it('places registry policy parameters before an endpoint fragment', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ source: { entry: 'checkout.json' } }), { status: 200 }),
      );
    const resolver = createRegistryResolver({
      endpoint: '/resolve?fixed=true#registry-fragment',
      fetch: request,
    });

    await resolver.resolve(normalizeAppRef({ name: 'checkout' }), context);

    const url = String(request.mock.calls[0]?.[0]);
    expect(url).toBe(
      '/resolve?fixed=true&expose=.%2Fapplication&name=checkout&environment=production&tenant=acme#registry-fragment',
    );
  });

  it('wraps registry HTTP failures as resolution errors', async () => {
    const resolver = createRegistryResolver({
      endpoint: '/resolve',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })),
    });

    await expect(resolver.resolve(normalizeAppRef({ name: 'checkout' }), context)).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.resolutionFailed,
        phase: 'resolve',
      }),
    );
  });

  it('uses fresh cache values and stale values only as failure fallback', async () => {
    let time = 1_000;
    const remote = vi
      .fn<AppResolver<string>['resolve']>()
      .mockResolvedValueOnce({
        ref: normalizeAppRef({ name: 'checkout' }),
        source: 'release-a',
      })
      .mockRejectedValueOnce(new Error('registry unavailable'))
      .mockRejectedValueOnce(new Error('still unavailable'));
    const resolver = createCachedResolver({
      cache: new MemoryResolutionCache(),
      now: () => time,
      resolver: { resolve: remote },
      staleTtlMs: 100,
      ttlMs: 10,
    });
    const ref = normalizeAppRef({ name: 'checkout' });

    await expect(resolver.resolve(ref, context)).resolves.toMatchObject({ source: 'release-a' });
    time += 5;
    await expect(resolver.resolve(ref, context)).resolves.toMatchObject({ source: 'release-a' });
    expect(remote).toHaveBeenCalledTimes(1);

    time += 10;
    await expect(resolver.resolve(ref, context)).resolves.toMatchObject({ source: 'release-a' });
    expect(remote).toHaveBeenCalledTimes(2);

    time += 101;
    await expect(resolver.resolve(ref, context)).rejects.toThrow('still unavailable');
  });

  it('does not return a stale value that expires while its refresh is pending', async () => {
    let time = 1_000;
    const ref = normalizeAppRef({ name: 'checkout' });
    const remote = vi
      .fn<AppResolver<string>['resolve']>()
      .mockResolvedValueOnce({ ref, source: 'release-a' })
      .mockImplementationOnce(() => {
        time = 1_111;
        throw new Error('slow registry failure');
      });
    const resolver = createCachedResolver({
      now: () => time,
      resolver: { resolve: remote },
      staleTtlMs: 100,
      ttlMs: 10,
    });

    await expect(resolver.resolve(ref, context)).resolves.toMatchObject({ source: 'release-a' });
    time = 1_015;
    await expect(resolver.resolve(ref, context)).rejects.toThrow('slow registry failure');
  });

  it('does not return or refresh a cached resolution after cancellation', async () => {
    const controller = new AbortController();
    const ref = normalizeAppRef({ name: 'checkout' });
    const set = vi.fn();
    const remote = vi.fn<AppResolver<string>['resolve']>(() => {
      controller.abort('cancelled during refresh');
      return { ref, source: 'release-b' };
    });
    const resolver = createCachedResolver({
      cache: {
        delete: vi.fn(),
        get: async () => {
          await Promise.resolve();
          return {
            expiresAt: 0,
            staleUntil: Number.POSITIVE_INFINITY,
            value: { ref, source: 'release-a' },
          };
        },
        set,
      },
      resolver: { resolve: remote },
    });
    const cancelledContext = {
      operation: { ...operation, signal: controller.signal },
      signal: controller.signal,
    };

    await expect(resolver.resolve(ref, cancelledContext)).rejects.toMatchObject({
      code: frontsErrorCodes.aborted,
    });
    expect(remote).toHaveBeenCalledOnce();
    expect(set).not.toHaveBeenCalled();
  });

  it('does not return a fresh value when an asynchronous cache lookup is cancelled', async () => {
    const controller = new AbortController();
    const ref = normalizeAppRef({ name: 'checkout' });
    const remote = vi.fn<AppResolver<string>['resolve']>();
    const resolver = createCachedResolver({
      cache: {
        delete: vi.fn(),
        get: async () => {
          await Promise.resolve();
          controller.abort('cancelled during cache lookup');
          return {
            expiresAt: Number.POSITIVE_INFINITY,
            staleUntil: Number.POSITIVE_INFINITY,
            value: { ref, source: 'release-a' },
          };
        },
        set: vi.fn(),
      },
      resolver: { resolve: remote },
    });

    await expect(
      resolver.resolve(ref, {
        operation: { ...operation, signal: controller.signal },
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.aborted });
    expect(remote).not.toHaveBeenCalled();
  });

  it('falls through resolver chains and preserves the final failure', async () => {
    const first = vi.fn<AppResolver<string>['resolve']>().mockRejectedValue(new Error('missing'));
    const second = vi.fn<AppResolver<string>['resolve']>().mockResolvedValue({
      ref: normalizeAppRef({ name: 'checkout' }),
      source: 'release-b',
    });
    const resolver = createFallbackResolver([{ resolve: first }, { resolve: second }]);
    const ref = normalizeAppRef({ name: 'checkout' });

    await expect(resolver.resolve(ref, context)).resolves.toMatchObject({ source: 'release-b' });
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('does not continue fallback resolution after cancellation', async () => {
    const controller = new AbortController();
    const second = vi.fn<AppResolver<string>['resolve']>();
    const resolver = createFallbackResolver<string>([
      {
        resolve() {
          controller.abort('cancelled');
          throw new Error('cancelled');
        },
      },
      { resolve: second },
    ]);

    await expect(
      resolver.resolve(normalizeAppRef({ name: 'checkout' }), {
        operation: { ...operation, signal: controller.signal },
        signal: controller.signal,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.aborted }),
    );
    expect(second).not.toHaveBeenCalled();
  });

  it('does not accept a successful fallback result after cancellation', async () => {
    const controller = new AbortController();
    const ref = normalizeAppRef({ name: 'checkout' });
    const resolver = createFallbackResolver<string>([
      {
        resolve() {
          controller.abort('cancelled before success');
          return { ref, source: 'release-a' };
        },
      },
    ]);

    await expect(
      resolver.resolve(ref, {
        operation: { ...operation, signal: controller.signal },
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.aborted });
  });

  it('stops registry preparation when an async policy callback cancels', async () => {
    const controller = new AbortController();
    const request = vi.fn<typeof fetch>();
    const resolver = createRegistryResolver({
      endpoint: async () => {
        await Promise.resolve();
        controller.abort('registry policy cancelled');
        return 'https://registry.example.test/resolve';
      },
      fetch: request,
    });

    await expect(
      resolver.resolve(normalizeAppRef({ name: 'checkout' }), {
        operation: { ...operation, signal: controller.signal },
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: frontsErrorCodes.aborted });
    expect(request).not.toHaveBeenCalled();
  });

  it('does not accept a static callback result after cancellation', async () => {
    const controller = new AbortController();
    const resolver = createStaticResolver<string>([
      {
        match: { name: 'checkout' },
        resolve() {
          controller.abort('static policy cancelled');
          return { source: 'release-a' };
        },
      },
    ]);

    expect(() =>
      resolver.resolve(normalizeAppRef({ name: 'checkout' }), {
        operation: { ...operation, signal: controller.signal },
        signal: controller.signal,
      }),
    ).toThrowError(expect.objectContaining({ code: frontsErrorCodes.aborted }));
  });
});
