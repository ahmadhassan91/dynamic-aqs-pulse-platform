import { AuditAction, Prisma } from '@pulse/db';

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
    data.beforeData = toJsonValue(input.beforeData);
  }
  if (input.afterData !== undefined) {
    data.afterData = toJsonValue(input.afterData);
  }
  if (input.metadata !== undefined) {
    data.metadata = toJsonValue(input.metadata);
  }

  return data;
}

function toJsonValue(value: JsonRecord): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
