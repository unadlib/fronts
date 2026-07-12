import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    clearMocks: true,
    coverage: {
      exclude: ['**/dist/**', '**/*.config.*', '**/test/**', '**/tests/**'],
      provider: 'v8',
      reporter: ['text', 'json-summary'],
    },
    environment: 'happy-dom',
    include: ['packages/**/test/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    mockReset: true,
    restoreMocks: true,
  },
});
