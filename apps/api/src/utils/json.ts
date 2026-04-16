import { Prisma } from '@pulse/db';

export const JSON_SIZE_LIMITS = {
  auditSnapshotBytes: 32 * 1024,
  auditMetadataBytes: 16 * 1024,
  migrationRunScopeBytes: 16 * 1024,
  migrationRunSummaryBytes: 32 * 1024,
  migrationRunReconciliationBytes: 32 * 1024,
  migrationSnapshotRawPayloadBytes: 256 * 1024,
  migrationSnapshotNormalizedPayloadBytes: 128 * 1024,
  migrationSnapshotMetadataBytes: 32 * 1024,
  websiteLeadSubmissionPayloadBytes: 32 * 1024,
  cisMetadataBytes: 16 * 1024,
  cisParsedStructuredPayloadBytes: 64 * 1024,
  cisParsedConfidenceMapBytes: 24 * 1024,
  cisParsedSafePayloadBytes: 16 * 1024,
  leadImportRunMappingsBytes: 16 * 1024,
  leadImportRunRowSourceValuesBytes: 24 * 1024,
  leadImportRunRowPayloadBytes: 24 * 1024,
  leadImportRunRowCandidatesBytes: 24 * 1024,
} as const;

export function toBoundedJsonValue(
  value: unknown,
  input: {
    field: string;
    maxBytes: number;
  },
): Prisma.InputJsonValue {
  let serialized: string;

  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Invalid ${input.field}: ${error.message}`
        : `Invalid ${input.field}`,
    );
  }

  if (serialized === undefined) {
    throw new Error(`Invalid ${input.field}: value cannot be serialized`);
  }

  const payloadBytes = Buffer.byteLength(serialized, 'utf8');
  if (payloadBytes > input.maxBytes) {
    throw new Error(
      `${input.field} exceeds max payload size of ${formatBytes(input.maxBytes)}`,
    );
  }

  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round((bytes / 1024) * 10) / 10}KB`;
  }

  return `${bytes}B`;
}
