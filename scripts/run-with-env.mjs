#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..');
const envCandidates = [
  path.join(rootDir, '.env.local'),
  path.join(rootDir, '.env'),
];

if (typeof process.loadEnvFile === 'function') {
  for (const envPath of envCandidates) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // Ignore missing env files. The command itself can fail with a clearer error if a value is required.
    }
  }
}

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Usage: node scripts/run-with-env.mjs <command> [args...]');
  process.exit(1);
}

const child = spawn(command, args, {
  cwd: rootDir,
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
