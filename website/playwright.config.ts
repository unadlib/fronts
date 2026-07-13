import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  reporter: 'line',
  retries: 0,
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4300',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm start',
    reuseExistingServer: true,
    timeout: 120_000,
    url: 'http://127.0.0.1:4300',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
