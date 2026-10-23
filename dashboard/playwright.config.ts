import { defineConfig } from '@playwright/test';
import chromium from '@sparticuz/chromium';
// Packaged Chromium is useful in restricted Linux sandboxes. Normal machines use
// `pnpm exec playwright install --with-deps chromium` and Playwright's browser.
const packaged = process.env.USE_PACKAGED_CHROMIUM === '1';
export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    launchOptions: packaged
      ? {
          executablePath: await chromium.executablePath(),
          args: chromium.args.filter((arg) => arg !== '--single-process'),
        }
      : undefined,
  },
  reporter: 'list',
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
