import { defineConfig } from '@rsbuild/core';

const origin = 'http://127.0.0.1:4103';

export default defineConfig({
  dev: { assetPrefix: origin },
  output: { assetPrefix: origin },
  server: { cors: true, port: 4103 },
});
