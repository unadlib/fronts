import { federation } from '@module-federation/vite';
import { defineConfig } from 'vite';

const origin = 'http://127.0.0.1:4201';
const cors = { origin: ['http://127.0.0.1:4200'] };

export default defineConfig({
  base: `${origin}/`,
  build: { target: 'chrome89' },
  plugins: [
    federation({
      dts: false,
      exposes: { './application': './src/application.ts' },
      filename: 'remoteEntry.js',
      manifest: true,
      name: 'fronts_vite_remote',
    }),
  ],
  preview: { cors, host: '127.0.0.1', port: 4201, strictPort: true },
  server: { cors, host: '127.0.0.1', origin, port: 4201, strictPort: true },
});
