import { describe, expect, it, vi } from 'vitest';

import {
  ContainerRegistry,
  createContainerRegistry,
  createDomContainer,
  createShadowContainer,
  frontsErrorCodes,
  type ApplicationIdentity,
  type ContainerAdapter,
  type FrontsError,
} from '../src/index.js';

const identity: ApplicationIdentity = {
  instanceId: 'checkout-1',
  name: 'checkout',
  version: '2.0.0',
};

describe('application containers', () => {
  it('creates an owned DOM boundary and disposes it idempotently', async () => {
    const parent = document.createElement('main');
    const prepared = await createDomContainer().prepare({
      identity,
      request: {
        attributes: { 'aria-label': 'Checkout' },
        className: 'remote-root',
        tagName: 'section',
        type: 'dom',
      },
      signal: new AbortController().signal,
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
      identity,
      request: { delegatesFocus: true, mode: 'open', type: 'shadow' },
      signal: new AbortController().signal,
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
        identity,
        request: { type: 'dom' },
        signal: controller.signal,
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
        identity,
        request: { type: 'native-shell' },
        signal: new AbortController().signal,
        target: parent,
      }),
    ).resolves.toMatchObject({ type: 'native-shell' });
    expect(adapter.prepare).toHaveBeenCalledOnce();

    expect(() => registry.register(adapter)).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.containerFailed }),
    );
  });

  it('ships DOM and Shadow adapters in the default registry', () => {
    const registry = createContainerRegistry();
    expect(registry.has('dom')).toBe(true);
    expect(registry.has('shadow')).toBe(true);
    expect(registry.has('iframe')).toBe(false);
  });
});
