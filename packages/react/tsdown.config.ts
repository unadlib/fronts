import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  deps: {
    neverBundle: ['@fronts/core', 'react', 'react-dom', 'react-dom/client'],
  },
  dts: true,
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  platform: 'neutral',
  publint: true,
  sourcemap: true,
  target: 'es2022',
});
