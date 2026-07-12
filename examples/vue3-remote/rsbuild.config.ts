import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';

const origin = 'http://127.0.0.1:4102';

export default defineConfig({
  dev: { assetPrefix: origin },
  output: { assetPrefix: origin },
  plugins: [
    pluginModuleFederation({
      dts: false,
      exposes: { './application': './src/application.ts' },
      name: 'fronts_vue_remote',
    }),
  ],
  server: { cors: { origin: ['http://127.0.0.1:4100'] }, port: 4102 },
});
