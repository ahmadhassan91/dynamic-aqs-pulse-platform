import { createHash } from 'node:crypto';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AppConfig } from '@pulse/config';

export type StoredDigitalAssetObject = {
  storageKey: string;
  sizeBytes: number;
  sha256: string;
  publicUrl?: string | undefined;
};

export type DigitalAssetStorageInput = {
  assetId: string;
  versionNumber: number;
  fileName: string;
  mimeType?: string | null | undefined;
  fileBase64: string;
};

let s3Client: S3Client | null = null;

export async function storeDigitalAssetObject(
  config: AppConfig,
  input: DigitalAssetStorageInput,
): Promise<StoredDigitalAssetObject> {
  const buffer = decodeBase64Payload(input.fileBase64);
  const storageKey = buildDigitalAssetStorageKey(input.assetId, input.versionNumber, input.fileName);
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  if (config.storage.provider === 's3') {
    if (!config.storage.s3Bucket) {
      throw new Error('PULSE_ASSET_S3_BUCKET is required when APP_STORAGE_PROVIDER=s3');
    }

    await getS3Client(config).send(new PutObjectCommand({
      Bucket: config.storage.s3Bucket,
      Key: storageKey,
      Body: buffer,
      ContentType: input.mimeType || undefined,
      Metadata: {
        assetId: input.assetId,
        versionNumber: String(input.versionNumber),
        sha256,
      },
    }));
  } else {
    const rootDir = path.resolve(config.storage.rootDir);
    const targetPath = path.resolve(rootDir, storageKey);
    if (!targetPath.startsWith(rootDir + path.sep)) {
      throw new Error('Digital asset storage key resolved outside the configured storage root');
    }
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, buffer);
  }

  return {
    storageKey,
    sizeBytes: buffer.byteLength,
    sha256,
    publicUrl: buildPublicAssetUrl(config, storageKey),
  };
}

export function buildPublicAssetUrl(config: AppConfig, storageKey: string | null | undefined) {
  const cleanKey = storageKey?.trim();
  if (!cleanKey) return undefined;
  const baseUrl = config.storage.publicBaseUrl
    ?? (config.storage.cloudFrontDomainName ? `https://${config.storage.cloudFrontDomainName}` : undefined);
  if (!baseUrl) return undefined;
  return `${baseUrl.replace(/\/+$/, '')}/${cleanKey.split('/').map(encodeURIComponent).join('/')}`;
}

function getS3Client(config: AppConfig) {
  if (!s3Client) {
    s3Client = new S3Client({ region: config.storage.s3Region ?? process.env.AWS_REGION ?? 'us-east-1' });
  }
  return s3Client;
}

function decodeBase64Payload(value: string) {
  const trimmed = value.trim();
  const payload = trimmed.includes(',') ? trimmed.slice(trimmed.indexOf(',') + 1) : trimmed;
  const buffer = Buffer.from(payload, 'base64');
  if (!buffer.byteLength) {
    throw new Error('fileBase64 payload is empty');
  }
  return buffer;
}

function buildDigitalAssetStorageKey(assetId: string, versionNumber: number, fileName: string) {
  const safeFileName = fileName
    .trim()
    .replace(/[/\\]/g, '-')
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .replace(/\s+/g, '-')
    || 'asset-file';
  return `digital-assets/${assetId}/v${versionNumber}/${safeFileName}`;
}
