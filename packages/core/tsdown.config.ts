import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  platform: 'neutral',
  publint: true,
  sourcemap: true,
  target: 'es2022',
});
