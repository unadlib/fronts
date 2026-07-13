import federation from '@originjs/vite-plugin-federation';
import { defineConfig } from 'vite';

const origin = 'http://127.0.0.1:4203';
const cors = { origin: ['http://127.0.0.1:4200'] };

export default defineConfig({
  base: `${origin}/`,
  build: { target: 'esnext' },
  plugins: [
    federation({
      exposes: { './application': './src/application.ts' },
      filename: 'remoteEntry.js',
      name: 'fronts_originjs_vite_remote',
      shared: {
        '@fronts/core': {
          // The plain runtime Host has no build-plugin share graph. Keep OriginJS's generated
          // fallback and exercise its share-scope negotiation through the official MF runtime.
          generate: true,
          import: true,
          requiredVersion: false,
        },
      },
    }),
  ],
  preview: { cors, host: '127.0.0.1', port: 4203, strictPort: true },
});
