import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    iframe: 'src/iframe/index.ts',
    index: 'src/index.ts',
    legacy: 'src/legacy/index.ts',
  },
  format: ['esm', 'cjs'],
  platform: 'neutral',
  publint: true,
  sourcemap: true,
  target: 'es2022',
});
