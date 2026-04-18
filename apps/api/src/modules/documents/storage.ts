import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AppConfig } from '../../config.js';

export async function storeBase64Document(
  config: AppConfig,
  input: {
    storageKey: string;
    contentBase64: string;
  },
) {
  const buffer = decodeBase64(input.contentBase64);
  const rootDir = path.resolve(config.storage.rootDir);
  const targetPath = path.resolve(rootDir, input.storageKey);

  if (!targetPath.startsWith(`${rootDir}${path.sep}`) && targetPath !== rootDir) {
    throw new Error('storageKey resolved outside the configured document root');
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, buffer);

  return {
    sizeBytes: buffer.byteLength,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

function decodeBase64(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('contentBase64 is required');
  }

  const buffer = Buffer.from(normalized, 'base64');
  if (buffer.byteLength === 0) {
    throw new Error('contentBase64 must decode to a non-empty file');
  }

  return buffer;
}
