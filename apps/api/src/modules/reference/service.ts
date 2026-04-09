import { assertActionAccess } from '@pulse/auth';
import { AuditAction, prisma, type Prisma } from '@pulse/db';
import type {
  CreateLeadSourceRequest,
  ReferenceListResponse,
  ReferenceValueSummary,
  UpdateReferenceValueRequest,
} from '@pulse/contracts';
import type { AuthenticatedActor } from '../auth/types.js';
import { buildAuditEntryData } from '../../utils/audit.js';

const BUSINESS_SEGMENT_ENTITY_TYPE = 'BUSINESS_SEGMENT_REF';
const LEAD_SOURCE_ENTITY_TYPE = 'LEAD_SOURCE_REF';

const DEFAULT_BUSINESS_SEGMENTS = [
  { code: 'residential', name: 'Residential', description: 'Residential-focused accounts and downstream views.', sortOrder: 10 },
  { code: 'commercial', name: 'Commercial', description: 'Commercial accounts and future workflow extensions.', sortOrder: 20 },
  { code: 'distributor', name: 'Distributor', description: 'Distributor and channel-partner classification.', sortOrder: 30 },
  { code: 'mixed', name: 'Mixed', description: 'Accounts that span more than one business segment.', sortOrder: 40 },
  { code: 'unknown', name: 'Unknown', description: 'Temporary fallback until governed classification is confirmed.', sortOrder: 50 },
] as const;

const DEFAULT_LEAD_SOURCES = [
  { code: 'branded_website', name: 'Branded Website', description: 'Lead entered from a branded website form.', sortOrder: 10 },
  { code: 'trade_show', name: 'Trade Show', description: 'Lead sourced from an event or trade show.', sortOrder: 20 },
  { code: 'phone', name: 'Phone', description: 'Lead sourced from direct phone contact.', sortOrder: 30 },
  { code: 'email', name: 'Email', description: 'Lead sourced from email intake.', sortOrder: 40 },
  { code: 'referral', name: 'Referral', description: 'Lead sourced from a partner or customer referral.', sortOrder: 50 },
  { code: 'affinity_roster', name: 'Affinity Group Roster', description: 'Lead sourced from affinity-group roster data.', sortOrder: 60 },
  { code: 'ownership_roster', name: 'Ownership / PE Roster', description: 'Lead sourced from ownership or private-equity roster data.', sortOrder: 70 },
  { code: 'manual_entry', name: 'Manual Entry', description: 'Lead created manually by BD or admin staff.', sortOrder: 80 },
] as const;

export async function ensureReferenceDataSeeded() {
  await prisma.$transaction(async (tx) => {
    await Promise.all([
      ...DEFAULT_BUSINESS_SEGMENTS.map((item) =>
        tx.businessSegmentRef.upsert({
          where: {
            code: item.code,
          },
          update: {},
          create: {
            code: item.code,
            name: item.name,
            description: item.description,
            sortOrder: item.sortOrder,
            isActive: true,
          },
        }),
      ),
      ...DEFAULT_LEAD_SOURCES.map((item) =>
        tx.leadSourceRef.upsert({
          where: {
            code: item.code,
          },
          update: {},
          create: {
            code: item.code,
            name: item.name,
            description: item.description,
            sortOrder: item.sortOrder,
            isActive: true,
          },
        }),
      ),
    ]);
  });
}

export async function listBusinessSegments(actor: AuthenticatedActor): Promise<ReferenceListResponse<ReferenceValueSummary>> {
  assertActionAccess(actor.role, 'reference.view');

  const items = await prisma.businessSegmentRef.findMany({
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' },
    ],
  });

  return {
    items: items.map(toReferenceValueSummary),
  };
}

export async function updateBusinessSegment(
  actor: AuthenticatedActor,
  id: string,
  input: UpdateReferenceValueRequest,
): Promise<ReferenceValueSummary | null> {
  assertActionAccess(actor.role, 'reference.manage');

  const current = await prisma.businessSegmentRef.findUnique({
    where: { id },
  });
  if (!current) {
    return null;
  }

  const data = buildReferenceValueUpdateData(input);
  if (Object.keys(data).length === 0) {
    throw new Error('At least one field must be provided');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.businessSegmentRef.update({
      where: { id },
      data,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: BUSINESS_SEGMENT_ENTITY_TYPE,
        entityId: next.id,
        beforeData: toReferenceValueAuditPayload(current),
        afterData: toReferenceValueAuditPayload(next),
        metadata: baseReferenceAuditMetadata(actor),
      }),
    });

    return next;
  });

  return toReferenceValueSummary(updated);
}

export async function listLeadSources(actor: AuthenticatedActor): Promise<ReferenceListResponse<ReferenceValueSummary>> {
  assertActionAccess(actor.role, 'reference.view');

  const items = await prisma.leadSourceRef.findMany({
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' },
    ],
  });

  return {
    items: items.map(toReferenceValueSummary),
  };
}

export async function createLeadSource(
  actor: AuthenticatedActor,
  input: CreateLeadSourceRequest,
): Promise<ReferenceValueSummary> {
  assertActionAccess(actor.role, 'reference.manage');

  const code = normalizeReferenceCode(input.code);
  const name = input.name?.trim();
  if (!code) {
    throw new Error('code is required');
  }
  if (!name) {
    throw new Error('name is required');
  }

  const created = await prisma.$transaction(async (tx) => {
    const description = optionalTrimmed(input.description);
    const next = await tx.leadSourceRef.create({
      data: {
        code,
        name,
        ...(description !== undefined ? { description } : {}),
        isActive: input.isActive ?? true,
        sortOrder: normalizeSortOrder(input.sortOrder),
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: LEAD_SOURCE_ENTITY_TYPE,
        entityId: next.id,
        afterData: toReferenceValueAuditPayload(next),
        metadata: baseReferenceAuditMetadata(actor),
      }),
    });

    return next;
  });

  return toReferenceValueSummary(created);
}

export async function updateLeadSource(
  actor: AuthenticatedActor,
  id: string,
  input: UpdateReferenceValueRequest,
): Promise<ReferenceValueSummary | null> {
  assertActionAccess(actor.role, 'reference.manage');

  const current = await prisma.leadSourceRef.findUnique({
    where: { id },
  });
  if (!current) {
    return null;
  }

  const data = buildReferenceValueUpdateData(input);
  if (Object.keys(data).length === 0) {
    throw new Error('At least one field must be provided');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.leadSourceRef.update({
      where: { id },
      data,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: LEAD_SOURCE_ENTITY_TYPE,
        entityId: next.id,
        beforeData: toReferenceValueAuditPayload(current),
        afterData: toReferenceValueAuditPayload(next),
        metadata: baseReferenceAuditMetadata(actor),
      }),
    });

    return next;
  });

  return toReferenceValueSummary(updated);
}

function buildReferenceValueUpdateData(input: UpdateReferenceValueRequest) {
  const data: Prisma.BusinessSegmentRefUpdateInput = {};

  const name = input.name?.trim();
  if (name) {
    data.name = name;
  }

  if (input.description !== undefined) {
    data.description = optionalTrimmed(input.description) ?? null;
  }
  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }
  if (input.sortOrder !== undefined) {
    data.sortOrder = normalizeSortOrder(input.sortOrder);
  }

  return data;
}

function toReferenceValueSummary(value: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): ReferenceValueSummary {
  const summary: ReferenceValueSummary = {
    id: value.id,
    code: value.code,
    name: value.name,
    isActive: value.isActive,
    sortOrder: value.sortOrder,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };

  if (value.description) {
    summary.description = value.description;
  }

  return summary;
}

function toReferenceValueAuditPayload(value: {
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}) {
  return {
    code: value.code,
    name: value.name,
    description: value.description,
    isActive: value.isActive,
    sortOrder: value.sortOrder,
  };
}

function baseReferenceAuditMetadata(actor: AuthenticatedActor) {
  return {
    sessionId: actor.sessionId,
    actorRole: actor.role,
    actorType: actor.actorType,
  };
}

function optionalTrimmed(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeReferenceCode(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }

  return trimmed.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeSortOrder(value: number | undefined) {
  if (value === undefined) {
    return 0;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new Error('sortOrder must be a non-negative integer');
  }

  return value;
}
