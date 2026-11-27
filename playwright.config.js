import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;
const dir = process.env.E2E_DIR || 'src';
// Production: https://document-tools.marc.io.vn/ (gốc domain). Đặt E2E_BASE=/document-tools/ để thử dưới đường dẫn con.
const BASE = process.env.E2E_BASE || '/';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    trace: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], permissions: ['clipboard-read', 'clipboard-write'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /uat\.spec/ },
  ],
  webServer: { command: `node scripts/serve.mjs ${dir} ${PORT} ${BASE}`, url: `http://localhost:${PORT}${BASE}`, reuseExistingServer: !process.env.CI },
});
