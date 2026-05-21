import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    viewport: { width: 1400, height: 900 },
    video: 'off',
  },
  reporter: 'list',
});
