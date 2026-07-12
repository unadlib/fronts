import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  FRONTS_APP_PROTOCOL,
  FRONTS_APP_PROTOCOL_VERSION,
  FRONTS_APP_SYMBOL,
  assertAppHandle,
  assertFrontsApp,
  defineApp,
  frontsErrorCodes,
  getFrontsApp,
  isFrontsApp,
  isFrontsAppModule,
  type FrontsError,
  type MountContext,
} from '../src/index.js';

interface TestProps {
  readonly value: string;
}

interface TestServices {
  readonly navigation: {
    go(path: string): void;
  };
}

function createApplication() {
  return defineApp<TestProps, TestServices>({
    name: 'test-app',
    capabilities: ['navigation'],
    mount: vi.fn(() => ({
      unmount: vi.fn(),
    })),
  });
}

describe('Fronts application protocol', () => {
  it('defines a branded, framework-neutral application', () => {
    const app = createApplication();

    expect(app.protocol).toBe(FRONTS_APP_PROTOCOL);
    expect(app.protocolVersion).toBe(FRONTS_APP_PROTOCOL_VERSION);
    expect(app.name).toBe('test-app');
    expect(app.capabilities).toEqual(['navigation']);
    expect(isFrontsApp(app)).toBe(true);
    expectTypeOf(app.mount).parameter(0).toEqualTypeOf<MountContext<TestProps, TestServices>>();
  });

  it('recognizes a structurally compatible remote application', () => {
    const app = {
      protocol: FRONTS_APP_PROTOCOL,
      protocolVersion: FRONTS_APP_PROTOCOL_VERSION,
      mount: vi.fn(() => ({ unmount: vi.fn() })),
    } as const;

    expect(isFrontsApp(app)).toBe(true);
    expect(() => assertFrontsApp(app)).not.toThrow();
  });

  it('unwraps the default export of a remote module', () => {
    const app = createApplication();
    const loaded = { default: app, other: true };

    expect(isFrontsAppModule(loaded)).toBe(true);
    expect(getFrontsApp(loaded)).toBe(app);
    expect(getFrontsApp(app)).toBe(app);
  });

  it('does not unwrap inherited module exports', () => {
    const loaded = Object.create({ default: createApplication() }) as object;

    expect(isFrontsAppModule(loaded)).toBe(false);
    expect(() => getFrontsApp(loaded)).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({ code: frontsErrorCodes.invalidApp }),
    );
  });

  it('rejects values that do not implement the application protocol', () => {
    expect(() => getFrontsApp({ default: { mount: vi.fn() } })).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.unsupportedProtocol,
      }),
    );

    expect(() => getFrontsApp({ default: {} })).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.invalidApp,
      }),
    );

    const forgedBrand = {
      [FRONTS_APP_SYMBOL]: true,
      mount: vi.fn(() => ({ unmount: vi.fn() })),
      protocol: 'fronts.application',
      protocolVersion: 1,
    };
    expect(isFrontsApp(forgedBrand)).toBe(false);
    expect(() => assertFrontsApp(forgedBrand)).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.unsupportedProtocol,
      }),
    );
  });

  it('validates handles returned by application mount functions', () => {
    expect(() => assertAppHandle({ unmount: vi.fn() })).not.toThrow();
    expect(() => assertAppHandle({ ready: Promise.resolve(), unmount: vi.fn() })).not.toThrow();

    expect(() => assertAppHandle({})).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.invalidApp,
        phase: 'mount',
      }),
    );

    expect(() => assertAppHandle({ ready: true, unmount: vi.fn() })).toThrowError(
      expect.objectContaining<Partial<FrontsError>>({
        code: frontsErrorCodes.invalidApp,
      }),
    );

    for (const method of ['activate', 'deactivate', 'update'] as const) {
      expect(() => assertAppHandle({ [method]: true, unmount: vi.fn() })).toThrowError(
        expect.objectContaining<Partial<FrontsError>>({
          code: frontsErrorCodes.invalidApp,
          details: { method },
          phase: 'mount',
        }),
      );
    }
  });
});
