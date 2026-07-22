import { describe, expect, it } from 'vitest';

import { nestedShallowEqual, shallowEqual } from '../src/equality.js';

describe('React host input equality', () => {
  it('compares plain records and arrays structurally', () => {
    expect(shallowEqual({ value: 'checkout' }, { value: 'checkout' })).toBe(true);
    expect(
      nestedShallowEqual({ attributes: { role: 'main' } }, { attributes: { role: 'main' } }),
    ).toBe(true);
    expect(nestedShallowEqual({ scopes: ['default'] }, { scopes: ['default'] })).toBe(true);
  });

  it('compares opaque objects by identity', () => {
    const retained = new Date(0);

    expect(nestedShallowEqual({ token: retained }, { token: retained })).toBe(true);
    expect(nestedShallowEqual({ token: new Date(0) }, { token: new Date(0) })).toBe(false);
    expect(shallowEqual(new Date(0), new Date(0))).toBe(false);
  });
});
