import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/production.spec.ts',
  timeout: 90000,
  workers: 1,
  use: {
    baseURL: process.env.PAGES_TEST_URL ?? 'http://127.0.0.1:4173/oubao-winter-journal/',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env.PAGES_TEST_PROXY
      ? { proxy: { server: process.env.PAGES_TEST_PROXY } }
      : {},
  },
  webServer: process.env.PAGES_TEST_URL
    ? undefined
    : {
        command: 'npm run preview -- --port 4173 --strictPort --base /oubao-winter-journal/',
        url: 'http://127.0.0.1:4173/oubao-winter-journal/',
        reuseExistingServer: false,
      },
});
