import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;
const dir = process.env.E2E_DIR || 'src';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], permissions: ['clipboard-read', 'clipboard-write'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /uat\.spec/ },
  ],
  webServer: { command: `node scripts/serve.mjs ${dir} ${PORT}`, port: PORT, reuseExistingServer: !process.env.CI },
});
