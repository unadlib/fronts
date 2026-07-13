import { defineConfig } from 'vite';
import federation from 'vite-plugin-federation';

const origin = 'http://127.0.0.1:4202';
const cors = { origin: ['http://127.0.0.1:4200'] };

export default defineConfig({
  base: `${origin}/`,
  build: { target: 'esnext' },
  plugins: [
    federation({
      dts: false,
      exposes: { './application': './src/application.ts' },
      filename: 'remoteEntry.js',
      manifest: true,
      name: 'fronts_vite_plugin_federation_remote',
      // The plugin-free host supplies no build-time share graph, so the Fronts protocol remains
      // self-contained in this producer exactly as it does in the official Vite example.
      shared: {},
    }),
  ],
  preview: { cors, host: '127.0.0.1', port: 4202, strictPort: true },
  server: { cors, host: '127.0.0.1', origin, port: 4202, strictPort: true },
});
