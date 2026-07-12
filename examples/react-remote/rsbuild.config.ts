import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

const origin = 'http://127.0.0.1:4101';

export default defineConfig({
  dev: { assetPrefix: origin },
  output: { assetPrefix: origin },
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      dts: false,
      exposes: { './application': './src/application.tsx' },
      name: 'fronts_react_remote',
    }),
  ],
  server: {
    cors: { origin: ['http://127.0.0.1:4100', 'http://127.0.0.1:4103'] },
    host: '127.0.0.1',
    port: 4101,
  },
});
