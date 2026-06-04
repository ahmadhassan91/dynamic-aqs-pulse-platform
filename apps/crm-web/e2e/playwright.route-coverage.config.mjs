import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootDir = path.resolve(e2eDir, '../../..');

export default defineConfig({
  testDir: e2eDir,
  testMatch: ['route-coverage.spec.mjs'],
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  outputDir: path.join(repoRootDir, 'output', 'playwright', 'ux-03-route-coverage-test-results'),
});
