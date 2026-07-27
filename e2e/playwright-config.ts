import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

export type ExampleServerMode = 'dev' | 'preview';

const examples = [
  ['@fronts-example/react-host', 4100],
  ['@fronts-example/react-remote', 4101],
  ['@fronts-example/vue3-remote', 4102],
  ['@fronts-example/iframe-remote', 4103],
  ['@fronts-example/core-only', 4110],
  ['@fronts-example/vite-host', 4200],
  ['@fronts-example/vite-remote', 4201],
  ['@fronts-example/vite-plugin-federation-remote', 4202],
  ['@fronts-example/originjs-vite-remote', 4203],
] as const;

export function createPlaywrightConfig(mode: ExampleServerMode): PlaywrightTestConfig {
  const webServer: NonNullable<PlaywrightTestConfig['webServer']> = examples.map(
    ([workspace, port]) => ({
      command: `pnpm --filter ${workspace} ${mode}`,
      reuseExistingServer: mode === 'dev' && process.env.CI === undefined,
      timeout: 120_000,
      url: `http://127.0.0.1:${port}`,
    }),
  );

  return defineConfig({
    expect: { timeout: 15_000 },
    forbidOnly: process.env.CI !== undefined,
    fullyParallel: true,
    metadata: { exampleServerMode: mode },
    outputDir: 'test-results',
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },
      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
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
    webServer,
    ...(process.env.CI === undefined ? {} : { workers: 1 }),
  });
}
