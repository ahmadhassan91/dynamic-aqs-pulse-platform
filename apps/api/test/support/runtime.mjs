import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const supportDir = path.dirname(fileURLToPath(import.meta.url));
const apiAppDir = path.resolve(supportDir, '..', '..');
const repoRootDir = path.resolve(apiAppDir, '..', '..');
const dbPackageDir = path.join(repoRootDir, 'packages', 'db');

export const TEST_DATABASE_NAME = 'pulse_platform_test';
export const TEST_DATABASE_URL = `postgresql://postgres@localhost:5432/${TEST_DATABASE_NAME}`;

export function applyTestEnvironment() {
  process.env.NODE_ENV = 'test';
  process.env.APP_NAME = process.env.APP_NAME || 'pulse-api-test';
  process.env.APP_VERSION = process.env.APP_VERSION || '0.1.0-test';
  process.env.PORT = process.env.PORT || '4100';
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
  process.env.APP_WEB_BASE_URL = process.env.APP_WEB_BASE_URL || 'http://localhost:3000';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.PG_BOSS_CONNECTION_STRING = TEST_DATABASE_URL;
  process.env.PGBOSS_SCHEMA = process.env.PGBOSS_SCHEMA || 'pgboss';
  process.env.PGBOSS_ARCHIVE_SECONDS = process.env.PGBOSS_ARCHIVE_SECONDS || '60';
  process.env.PGBOSS_DELETE_AFTER_SECONDS = process.env.PGBOSS_DELETE_AFTER_SECONDS || '60';
  process.env.PGBOSS_MONITOR_INTERVAL_SECONDS = process.env.PGBOSS_MONITOR_INTERVAL_SECONDS || '1';
  process.env.PGBOSS_POLLING_INTERVAL_SECONDS = process.env.PGBOSS_POLLING_INTERVAL_SECONDS || '1';
  process.env.PGBOSS_DEAD_LETTER_QUEUE = process.env.PGBOSS_DEAD_LETTER_QUEUE || 'pulse.dead-letter';
  process.env.ACUMATICA_BASE_URL = process.env.ACUMATICA_BASE_URL || 'https://example.acumatica.local';
  process.env.ACUMATICA_API_VERSION = process.env.ACUMATICA_API_VERSION || '24.100.001';
  process.env.ACUMATICA_COMPANY = process.env.ACUMATICA_COMPANY || 'Dynamic AQS';
  process.env.ACUMATICA_USERNAME = process.env.ACUMATICA_USERNAME || 'svc-pulse';
  process.env.ACUMATICA_PASSWORD = process.env.ACUMATICA_PASSWORD || 'replace-me';
  process.env.MIGRATION_ADMIN_TOKEN = process.env.MIGRATION_ADMIN_TOKEN || 'test-migration-token';
  process.env.AUTH_ISSUER = process.env.AUTH_ISSUER || 'pulse.local';
  process.env.AUTH_ACCESS_TOKEN_TTL_MINUTES = process.env.AUTH_ACCESS_TOKEN_TTL_MINUTES || '15';
  process.env.AUTH_REFRESH_TOKEN_TTL_DAYS = process.env.AUTH_REFRESH_TOKEN_TTL_DAYS || '14';
  process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL = process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL || 'admin@pulse.local';
  process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD || 'replace-me';
  process.env.AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME =
    process.env.AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME || 'Pulse Bootstrap Admin';
  process.env.AUTH_BOOTSTRAP_ADMIN_ROLE = process.env.AUTH_BOOTSTRAP_ADMIN_ROLE || 'SUPER_ADMIN';
}

export function ensureTestDatabaseReady() {
  const exists = execFileSync(
    'psql',
    ['-d', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname = '${TEST_DATABASE_NAME}'`],
    { encoding: 'utf8' },
  ).trim();

  if (exists !== '1') {
    execFileSync('createdb', [TEST_DATABASE_NAME], { stdio: 'inherit' });
  }

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], {
    cwd: dbPackageDir,
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
    },
    stdio: 'inherit',
  });
}

export async function resetDatabase(prisma) {
  await prisma.$disconnect();

  const tables = await queryRows(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `);

  const tableNames = tables
    .map((row) => row.tablename)
    .filter((value) => typeof value === 'string' && value.length > 0);

  if (tableNames.length === 0) {
    return;
  }

  const quotedTables = tableNames
    .map((tableName) => `"public"."${tableName.replace(/"/g, '""')}"`)
    .join(', ');

  execFileSync('psql', [TEST_DATABASE_URL, '-c', `TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE;`], {
    stdio: 'inherit',
  });

  await prisma.$connect();
}

export function getApiAppDir() {
  return apiAppDir;
}

function queryRows(sql) {
  const output = execFileSync('psql', [TEST_DATABASE_URL, '-tA', '-F', '\t', '-c', sql], {
    encoding: 'utf8',
  }).trim();

  if (!output) {
    return [];
  }

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((tablename) => ({ tablename }));
}
