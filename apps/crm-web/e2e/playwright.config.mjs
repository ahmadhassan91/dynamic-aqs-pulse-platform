import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootDir = path.resolve(e2eDir, '../../..');
const apiAppDir = path.join(repoRootDir, 'apps', 'api');
const crmWebAppDir = path.join(repoRootDir, 'apps', 'crm-web');
const testDatabaseUrl = 'postgresql://postgres@localhost:5432/pulse_platform_test';

const sharedEnv = {
  ...process.env,
  NODE_ENV: 'test',
  APP_NAME: 'pulse-e2e',
  APP_VERSION: '0.1.0-e2e',
  PORT: '4100',
  LOG_LEVEL: 'error',
  APP_WEB_BASE_URL: 'http://127.0.0.1:3101',
  DATABASE_URL: testDatabaseUrl,
  PG_BOSS_CONNECTION_STRING: testDatabaseUrl,
  PGBOSS_SCHEMA: 'pgboss',
  PGBOSS_ARCHIVE_SECONDS: '60',
  PGBOSS_DELETE_AFTER_SECONDS: '60',
  PGBOSS_MONITOR_INTERVAL_SECONDS: '1',
  PGBOSS_POLLING_INTERVAL_SECONDS: '1',
  PGBOSS_DEAD_LETTER_QUEUE: 'pulse.dead-letter',
  ACUMATICA_BASE_URL: 'https://example.acumatica.local',
  ACUMATICA_API_VERSION: '24.100.001',
  ACUMATICA_COMPANY: 'Dynamic AQS',
  ACUMATICA_USERNAME: 'svc-pulse',
  ACUMATICA_PASSWORD: 'replace-me',
  MIGRATION_ADMIN_TOKEN: 'test-migration-token',
  AUTH_ISSUER: 'pulse.local',
  AUTH_ACCESS_TOKEN_TTL_MINUTES: '15',
  AUTH_REFRESH_TOKEN_TTL_DAYS: '14',
  AUTH_BOOTSTRAP_ADMIN_EMAIL: 'admin@pulse.local',
  AUTH_BOOTSTRAP_ADMIN_PASSWORD: 'replace-me',
  AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME: 'Pulse Bootstrap Admin',
  AUTH_BOOTSTRAP_ADMIN_ROLE: 'SUPER_ADMIN',
  NEXT_PUBLIC_PULSE_API_BASE_URL: 'http://127.0.0.1:4100',
  NEXT_PUBLIC_PULSE_WEB_BASE_URL: 'http://127.0.0.1:3101',
};

export default defineConfig({
  testDir: e2eDir,
  testMatch: ['flows.spec.mjs', 'lead-activity-note.spec.mjs'],
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: 'list',
  outputDir: path.join(repoRootDir, 'output', 'playwright', 'crm-web-e2e'),
  use: {
    baseURL: 'http://127.0.0.1:3101',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm start',
      cwd: apiAppDir,
      env: {
        ...sharedEnv,
        PORT: '4100',
      },
      url: 'http://127.0.0.1:4100/api/v1/health/live',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm build && pnpm start --port 3101',
      cwd: crmWebAppDir,
      env: {
        ...sharedEnv,
        NEXT_PUBLIC_PULSE_API_BASE_URL: 'http://127.0.0.1:4100',
        NEXT_PUBLIC_PULSE_WEB_BASE_URL: 'http://127.0.0.1:3101',
      },
      url: 'http://127.0.0.1:3101/auth/login',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
