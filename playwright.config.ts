import { defineConfig } from '@playwright/test';

const DB = process.env.TEST_DATABASE_URL ?? 'postgres://tawreed:tawreed@localhost:5432/tawreed_test';
const common = {
  DATABASE_URL: DB, SESSION_SECRET: 'e2e-secret-0123456789abcdef0123456789abcdef', AI_PROVIDER: 'mock',
  MOYASAR_PUBLISHABLE_KEY: 'pk_test_e2e', MOYASAR_SECRET_KEY: 'sk_test_e2e', MOYASAR_API_BASE: 'http://localhost:4010/v1', NODE_ENV: 'production'
};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'qa/playwright-report' }], ['json', { outputFile: 'qa/results.json' }]],
  globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: 'http://localhost:3100', screenshot: 'only-on-failure', trace: 'retain-on-failure', viewport: { width: 1360, height: 900 }, launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {} },
  webServer: [
    { command: 'node tests/e2e/mock-moyasar.mjs', url: 'http://localhost:4010/health', reuseExistingServer: false, env: { PORT: '4010' } },
    { command: 'node .next/standalone/server.js', url: 'http://localhost:3100/login', reuseExistingServer: false, timeout: 120_000, stderr: 'pipe', env: { ...common, APP_URL: 'http://localhost:3100', PAYMENT_MODE: 'bypass', PORT: '3100', HOSTNAME: '127.0.0.1' } },
    { command: 'node .next/standalone/server.js', url: 'http://localhost:3101/login', reuseExistingServer: false, timeout: 120_000, stderr: 'pipe', env: { ...common, APP_URL: 'http://localhost:3101', PAYMENT_MODE: 'sandbox', PORT: '3101', HOSTNAME: '127.0.0.1' } }
  ]
});
