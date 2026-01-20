import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './app',
  testMatch: '**/*.e2e.ts',
  timeout: 30000,
  use: { baseURL: process.env.BASE_URL || 'http://localhost:3000' },
});
