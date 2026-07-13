import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

const servers: NonNullable<PlaywrightTestConfig['webServer']> = [
  ['@fronts-example/react-host', 4100],
  ['@fronts-example/react-remote', 4101],
  ['@fronts-example/vue3-remote', 4102],
  ['@fronts-example/iframe-remote', 4103],
  ['@fronts-example/core-only', 4110],
].map(([workspace, port]) => ({
  command: `pnpm --filter ${workspace} dev`,
  reuseExistingServer: process.env.CI === undefined,
  timeout: 120_000,
  url: `http://127.0.0.1:${port}`,
}));

export default defineConfig({
  expect: { timeout: 15_000 },
  forbidOnly: process.env.CI !== undefined,
  fullyParallel: true,
  outputDir: 'test-results',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter:
    process.env.CI === undefined
      ? 'list'
      : [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  retries: process.env.CI === undefined ? 0 : 2,
  testDir: './e2e',
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:4100',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: servers,
  ...(process.env.CI === undefined ? {} : { workers: 1 }),
});
