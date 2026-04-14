import { AuditAction, Prisma } from '@pulse/db';
import { JSON_SIZE_LIMITS, toBoundedJsonValue } from './json.js';

type JsonRecord = Record<string, unknown>;

export function buildAuditEntryData(input: {
  actorUserId?: string | undefined;
  action: AuditAction;
  entityType: string;
  entityId?: string | undefined;
  requestId?: string | undefined;
  correlationId?: string | undefined;
  sourceSystem?: string | undefined;
  beforeData?: JsonRecord | undefined;
  afterData?: JsonRecord | undefined;
  metadata?: JsonRecord | undefined;
}) {
  const data: Prisma.AuditEntryCreateInput = {
    action: input.action,
    entityType: input.entityType,
    sourceSystem: input.sourceSystem ?? 'pulse-api',
  };

  if (input.actorUserId !== undefined) {
    data.actor = {
      connect: {
        id: input.actorUserId,
      },
    };
  }

  if (input.entityId !== undefined) {
    data.entityId = input.entityId;
  }
  if (input.requestId !== undefined) {
    data.requestId = input.requestId;
  }
  if (input.correlationId !== undefined) {
    data.correlationId = input.correlationId;
  }
  if (input.beforeData !== undefined) {
    data.beforeData = toBoundedJsonValue(input.beforeData, {
      field: 'beforeData',
      maxBytes: JSON_SIZE_LIMITS.auditSnapshotBytes,
    });
  }
  if (input.afterData !== undefined) {
    data.afterData = toBoundedJsonValue(input.afterData, {
      field: 'afterData',
      maxBytes: JSON_SIZE_LIMITS.auditSnapshotBytes,
    });
  }
  if (input.metadata !== undefined) {
    data.metadata = toBoundedJsonValue(input.metadata, {
      field: 'metadata',
      maxBytes: JSON_SIZE_LIMITS.auditMetadataBytes,
    });
  }

  return data;
}
