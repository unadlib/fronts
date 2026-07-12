import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    clearMocks: true,
    coverage: {
      exclude: ['**/dist/**', '**/*.config.*', '**/test/**', '**/tests/**'],
      include: ['packages/*/src/**/*.{ts,tsx}'],
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: 'happy-dom',
    include: ['packages/**/test/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    mockReset: true,
    restoreMocks: true,
  },
});
