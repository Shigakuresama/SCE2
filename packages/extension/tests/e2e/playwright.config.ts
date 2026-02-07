import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for SCE2 Extension E2E tests
 *
 * This config is optimized for Chrome Extension testing with:
 * - Custom Chrome channel for extension loading
 * - Extension path pre-loaded for each test
 * - BaseURL pointing to local dev server
 */
export default defineConfig({
  testDir: './scenarios',
  fullyParallel: false, // Extensions often require sequential execution
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid extension conflicts
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3333',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        // Launch options for extension testing
        launchOptions: {
          args: [
            `--disable-extensions-except=${process.env.EXTENSION_PATH || './dist'}`,
            `--load-extension=${process.env.EXTENSION_PATH || './dist'}`,
          ],
          // Use Chrome channel for better extension support
          channel: 'chrome',
        },
      },
    },
  ],

  // Run local dev server before starting tests
  webServer: {
    command: 'cd ../../../cloud-server && npm run dev',
    url: 'http://localhost:3333',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
