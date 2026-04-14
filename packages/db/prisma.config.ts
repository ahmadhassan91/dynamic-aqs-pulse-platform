import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootDir = path.resolve(currentDir, '../..');
const envCandidates = [
  path.join(repoRootDir, '.env.local'),
  path.join(repoRootDir, '.env'),
];

if (typeof process.loadEnvFile === 'function') {
  for (const envPath of envCandidates) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // Ignore missing env files; Prisma will surface required-variable errors later.
    }
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
});
