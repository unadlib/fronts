import { describe, expect, it, vi } from 'vitest';

import {
  ContainerRegistry,
  createContainerRegistry,
  createDomContainer,
  createShadowContainer,
  frontsErrorCodes,
  type ApplicationIdentity,
  type ApplicationHostOperationContext,
  type ContainerAdapter,
  type FrontsError,
} from '../src/index.js';

const identity: ApplicationIdentity = {
  instanceId: 'checkout-1',
  name: 'checkout',
  version: '2.0.0',
};

function createOperationContext(signal = new AbortController().signal): {
  operation: ApplicationHostOperationContext;
  signal: AbortSignal;
} {
  return {
    operation: {
      hostId: 'container-test-host',
      identity,
      intent: 'mount',
      operationId: 'container-test-operation',
      signal,
      traceId: 'container-test-trace',
    },
    signal,
  };
}

describe('application containers', () => {
  it('creates an owned DOM boundary and disposes it idempotently', async () => {
    const parent = document.createElement('main');
    const prepared = await createDomContainer().prepare({
      ...createOperationContext(),
      identity,
      request: {
        attributes: { 'aria-label': 'Checkout' },
        className: 'remote-root',
        tagName: 'section',
        type: 'dom',
      },
      target: parent,
    });

    expect(prepared.element.tagName).toBe('SECTION');
    expect(prepared.target).toBe(prepared.element);
    expect(prepared.element.className).toBe('remote-root');
    expect(prepared.element.getAttribute('aria-label')).toBe('Checkout');
    expect(prepared.element.getAttribute('data-fronts-instance')).toBe('checkout-1');
    expect(parent.children).toHaveLength(1);

    await prepared.dispose();
    await prepared.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('creates a real ShadowRoot while keeping an owned host boundary', async () => {
    const parent = document.createElement('main');
    const prepared = await createShadowContainer().prepare({
      ...createOperationContext(),
      identity,
      request: { delegatesFocus: true, mode: 'open', type: 'shadow' },
      target: parent,
    });

    expect(prepared.target).toBeInstanceOf(ShadowRoot);
    expect(prepared.element.shadowRoot).toBe(prepared.target);
    expect(prepared.element.getAttribute('data-fronts-container')).toBe('shadow');

    await prepared.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('does not mutate the DOM when preparation is already aborted', async () => {
    const parent = document.createElement('main');
    const controller = new AbortController();
    controller.abort('navigation changed');

    expect(() =>
      createDomContainer().prepare({
        ...createOperationContext(controller.signal),
        identity,
        request: { type: 'dom' },
        target: parent,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.aborted }),
    );
    expect(parent.children).toHaveLength(0);
  });

  it('supports custom adapters through a collision-safe registry', async () => {
    const adapter: ContainerAdapter = {
      type: 'native-shell',
      prepare: vi.fn(({ target }) => {
        const element = document.createElement('aside');
        target.append(element);
        return {
          dispose: () => element.remove(),
          element,
          target: element,
          type: 'native-shell',
        };
      }),
    };
    const registry = new ContainerRegistry([adapter]);
    const parent = document.createElement('main');

    expect(registry.has('native-shell')).toBe(true);
    await expect(
      registry.prepare({
        ...createOperationContext(),
        identity,
        request: { type: 'native-shell' },
        target: parent,
      }),
    ).resolves.toMatchObject({ type: 'native-shell' });
    expect(adapter.prepare).toHaveBeenCalledOnce();

    expect(() => registry.register(adapter)).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.containerFailed }),
    );
  });

  it.each([
    null,
    { prepare: () => undefined, type: '' },
    { prepare: () => undefined, type: ' padded ' },
    { type: 'missing-prepare' },
  ])('rejects the invalid container adapter %j during registration', (adapter) => {
    expect(() => new ContainerRegistry([adapter as unknown as ContainerAdapter])).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.containerFailed,
        phase: 'container',
      }),
    );
  });

  it('rejects and rolls back invalid prepared container results', async () => {
    const parent = document.createElement('main');
    document.body.append(parent);
    const dispose = vi.fn(() => undefined);
    const registry = new ContainerRegistry([
      {
        type: 'invalid',
        prepare() {
          const element = document.createElement('section');
          parent.append(element);
          return {
            dispose: () => {
              dispose();
              element.remove();
            },
            element,
            ownsElement: true,
            target: element,
            type: 'wrong-type',
          };
        },
      },
    ]);

    await expect(
      registry.prepare({
        ...createOperationContext(),
        identity,
        request: { type: 'invalid' },
        target: parent,
      }),
    ).rejects.toMatchObject({
      code: frontsErrorCodes.containerFailed,
      details: { expectedType: 'invalid', receivedType: 'wrong-type' },
      phase: 'container',
    });
    expect(dispose).toHaveBeenCalledOnce();
    expect(parent.children).toHaveLength(0);
    parent.remove();
  });

  it('ships DOM and Shadow adapters in the default registry', () => {
    const registry = createContainerRegistry();
    expect(registry.has('dom')).toBe(true);
    expect(registry.has('shadow')).toBe(true);
    expect(registry.has('iframe')).toBe(false);
  });
});
