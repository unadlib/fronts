import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  html: { template: './src/index.html' },
  server: { host: '127.0.0.1', port: 4110 },
});
