import { defineConfig } from '@playwright/test';

// En el runner de Playwright (Node.js fuera de Next.js), interceptar server-only
try {
  const resolved = require.resolve('server-only');
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: {},
  } as any;
} catch {
  // No-op si no se resuelve vía require
}

export default defineConfig({
  testDir: './e2e/specs',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://cadeapp-staging.vercel.app',
    contextOptions: {
      reducedMotion: 'reduce',
    },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /global-settings\.spec\.ts$/,
      use: {
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'global-settings',
      testMatch: /global-settings\.spec\.ts$/,
      fullyParallel: false,
      use: {
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
