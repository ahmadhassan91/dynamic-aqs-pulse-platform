import { assertActionAccess } from '@pulse/auth';
import { AuditAction, LeadStage, prisma } from '@pulse/db';
import type {
  AffinityGroupReferenceSummary,
  AffinityGroupTypeKey,
  BrandLabelReferenceSummary,
  AffinityGroupImportRow,
  CreateAffinityGroupRequest,
  CreateLeadSourceRequest,
  CreateOwnershipGroupRequest,
  LeadSourceImportRow,
  LeadStageReferenceSummary,
  LeadStageImportRow,
  OwnershipGroupReferenceSummary,
  OwnershipGroupImportRow,
  OwnershipGroupTypeKey,
  ReferenceImportRequest,
  ReferenceImportResponse,
  ReferenceListResponse,
  ReferenceValueSummary,
  UpdateAffinityGroupRequest,
  UpdateLeadStageReferenceRequest,
  UpdateOwnershipGroupRequest,
  UpdateReferenceValueRequest,
} from '@pulse/contracts';
import type { AuthenticatedActor } from '../auth/types.js';
import { buildAuditEntryData } from '../../utils/audit.js';
export {
  commitGroupRosterImportRun,
  getGroupRosterImportRun,
  previewGroupRosterImport,
  reviewGroupRosterImport,
} from './roster-service.js';

const BUSINESS_SEGMENT_ENTITY_TYPE = 'BUSINESS_SEGMENT_REF';
const AFFINITY_GROUP_ENTITY_TYPE = 'AFFINITY_GROUP_REF';
const OWNERSHIP_GROUP_ENTITY_TYPE = 'OWNERSHIP_GROUP_REF';
const LEAD_SOURCE_ENTITY_TYPE = 'LEAD_SOURCE_REF';
const LEAD_STAGE_ENTITY_TYPE = 'LEAD_STAGE_REF';
let referenceSeedPromise: Promise<void> | null = null;

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

const DEFAULT_AFFINITY_GROUPS = [
  {
    code: 'NEXSTAR',
    name: 'Nexstar Network',
    shortName: 'Nexstar',
    description: 'Buying group and best-practice network membership.',
    groupType: 'buying_group',
    sortOrder: 10,
  },
  {
    code: 'CERTAINPATH',
    name: 'CertainPath',
    shortName: 'CertainPath',
    description: 'Coaching and business-development network.',
    groupType: 'coaching_network',
    sortOrder: 20,
  },
  {
    code: 'EGIA',
    name: 'EGIA',
    shortName: 'EGIA',
    description: 'Industry education and coaching network.',
    groupType: 'coaching_network',
    sortOrder: 30,
  },
  {
    code: 'AIRESERV',
    name: 'AireServ',
    shortName: 'AireServ',
    description: 'Franchise network membership.',
    groupType: 'franchise',
    sortOrder: 40,
  },
  {
    code: 'ONE_HOUR',
    name: 'One Hour Heating & Air Conditioning',
    shortName: 'One Hour',
    description: 'Franchise network membership.',
    groupType: 'franchise',
    sortOrder: 50,
  },
] as const satisfies ReadonlyArray<{
  code: string;
  name: string;
  shortName: string;
  description: string;
  groupType: AffinityGroupTypeKey;
  sortOrder: number;
}>;

const DEFAULT_OWNERSHIP_GROUPS = [
  {
    code: 'REDWOOD_SERVICES',
    name: 'Redwood Services',
    shortName: 'Redwood',
    description: 'Private equity / common ownership overlay.',
    ownershipType: 'private_equity',
    sortOrder: 10,
  },
  {
    code: 'APOLLO',
    name: 'Apollo',
    shortName: 'Apollo',
    description: 'Private equity ownership overlay.',
    ownershipType: 'private_equity',
    sortOrder: 20,
  },
] as const satisfies ReadonlyArray<{
  code: string;
  name: string;
  shortName: string;
  description: string;
  ownershipType: OwnershipGroupTypeKey;
  sortOrder: number;
}>;

const DEFAULT_LEAD_STAGES = [
  {
    stage: LeadStage.NEW,
    code: 'new',
    name: 'New Lead',
    dashboardLabel: 'New',
    description: 'New lead awaiting first contact and qualification follow-through.',
    sortOrder: 10,
    isTerminal: false,
  },
  {
    stage: LeadStage.DISCOVERY_SCHEDULED,
    code: 'discovery_scheduled',
    name: 'Discovery Scheduled',
    dashboardLabel: 'Discovery Scheduled',
    description: 'Discovery call or discovery step has been scheduled.',
    sortOrder: 20,
    isTerminal: false,
  },
  {
    stage: LeadStage.DISCOVERY_COMPLETED,
    code: 'discovery_completed',
    name: 'Discovery Completed',
    dashboardLabel: 'Discovery Complete',
    description: 'Discovery findings have been captured or an approved skip reason is on file.',
    sortOrder: 30,
    isTerminal: false,
  },
  {
    stage: LeadStage.CIS_SENT,
    code: 'cis_sent',
    name: 'CIS Sent',
    dashboardLabel: 'CIS Sent',
    description: 'CIS / credit onboarding package has been sent to the lead.',
    sortOrder: 40,
    isTerminal: false,
  },
  {
    stage: LeadStage.CIS_SIGNED,
    code: 'cis_signed',
    name: 'CIS Signed',
    dashboardLabel: 'CIS Signed',
    description: 'CIS package has been returned and accepted for onboarding progression.',
    sortOrder: 50,
    isTerminal: false,
  },
  {
    stage: LeadStage.ONBOARDING_COMPLETED,
    code: 'onboarding_completed',
    name: 'Onboarding Completed',
    dashboardLabel: 'Onboarding Complete',
    description: 'Operational onboarding steps are complete and the lead is customer-ready.',
    sortOrder: 60,
    isTerminal: false,
  },
  {
    stage: LeadStage.CUSTOMER_ACTIVE,
    code: 'customer_active',
    name: 'Customer Active',
    dashboardLabel: 'Customer Active',
    description: 'First order milestone reached and the lead has transitioned into an active customer.',
    sortOrder: 70,
    isTerminal: true,
  },
] as const;

export async function ensureReferenceDataSeeded() {
  if (referenceSeedPromise) {
    return referenceSeedPromise;
  }

  referenceSeedPromise = ensureReferenceDataSeededInternal().finally(() => {
    referenceSeedPromise = null;
  });

  return referenceSeedPromise;
}

async function ensureReferenceDataSeededInternal() {
  await prisma.$transaction(async (tx) => {
    await tx.businessSegmentRef.createMany({
      data: DEFAULT_BUSINESS_SEGMENTS.map((item) => ({
        code: item.code,
        name: item.name,
        description: item.description,
        sortOrder: item.sortOrder,
        isActive: true,
      })),
      skipDuplicates: true,
    });

    await tx.leadSourceRef.createMany({
      data: DEFAULT_LEAD_SOURCES.map((item) => ({
        code: item.code,
        name: item.name,
        description: item.description,
        sortOrder: item.sortOrder,
        isActive: true,
      })),
      skipDuplicates: true,
    });

    await tx.leadStageRef.createMany({
      data: DEFAULT_LEAD_STAGES.map((item) => ({
        stage: item.stage,
        code: item.code,
        name: item.name,
        dashboardLabel: item.dashboardLabel,
        description: item.description,
        sortOrder: item.sortOrder,
        isActive: true,
        isTerminal: item.isTerminal,
      })),
      skipDuplicates: true,
    });

    await tx.affinityGroupRef.createMany({
      data: DEFAULT_AFFINITY_GROUPS.map((item) => ({
        code: item.code,
        name: item.name,
        shortName: item.shortName,
        description: item.description,
        groupType: toAffinityGroupTypeEnum(item.groupType),
        isActive: true,
        sortOrder: item.sortOrder,
      })),
      skipDuplicates: true,
    });

    await tx.ownershipGroupRef.createMany({
      data: DEFAULT_OWNERSHIP_GROUPS.map((item) => ({
        code: item.code,
        name: item.name,
        shortName: item.shortName,
        description: item.description,
        ownershipType: toOwnershipGroupTypeEnum(item.ownershipType),
        isActive: true,
        sortOrder: item.sortOrder,
      })),
      skipDuplicates: true,
    });
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

export async function listLeadStages(actor: AuthenticatedActor): Promise<ReferenceListResponse<LeadStageReferenceSummary>> {
  assertActionAccess(actor.role, 'reference.view');

  const items = await prisma.leadStageRef.findMany({
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' },
    ],
  });

  return {
    items: items.map(toLeadStageReferenceSummary),
  };
}

export async function listAffinityGroups(actor: AuthenticatedActor): Promise<ReferenceListResponse<AffinityGroupReferenceSummary>> {
  assertActionAccess(actor.role, 'reference.view');

  const items = await prisma.affinityGroupRef.findMany({
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' },
    ],
  });

  return {
    items: items.map(toAffinityGroupReferenceSummary),
  };
}

export async function listOwnershipGroups(actor: AuthenticatedActor): Promise<ReferenceListResponse<OwnershipGroupReferenceSummary>> {
  assertActionAccess(actor.role, 'reference.view');

  const items = await prisma.ownershipGroupRef.findMany({
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' },
    ],
  });

  return {
    items: items.map(toOwnershipGroupReferenceSummary),
  };
}

export async function listBrandLabels(actor: AuthenticatedActor): Promise<ReferenceListResponse<BrandLabelReferenceSummary>> {
  assertActionAccess(actor.role, 'reference.view');

  const items = await prisma.brandLabelRef.findMany({
    where: { isActive: true },
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' },
    ],
  });

  return {
    items: items.map(toBrandLabelReferenceSummary),
  };
}

export async function createAffinityGroup(
  actor: AuthenticatedActor,
  input: CreateAffinityGroupRequest,
): Promise<AffinityGroupReferenceSummary> {
  assertActionAccess(actor.role, 'reference.manage');

  const normalized = normalizeAffinityGroupCreateInput(input);

  const created = await prisma.$transaction(async (tx) => {
    const next = await tx.affinityGroupRef.create({
      data: {
        code: normalized.code,
        name: normalized.name,
        ...(normalized.shortName !== undefined ? { shortName: normalized.shortName } : {}),
        ...(normalized.description !== undefined ? { description: normalized.description } : {}),
        groupType: toAffinityGroupTypeEnum(normalized.groupType),
        isActive: normalized.isActive ?? true,
        sortOrder: normalized.sortOrder ?? 0,
        ...(normalized.notes !== undefined ? { notes: normalized.notes } : {}),
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: AFFINITY_GROUP_ENTITY_TYPE,
        entityId: next.id,
        afterData: toAffinityGroupAuditPayload(next),
        metadata: baseReferenceAuditMetadata(actor),
      }),
    });

    return next;
  });

  return toAffinityGroupReferenceSummary(created);
}

export async function updateAffinityGroup(
  actor: AuthenticatedActor,
  id: string,
  input: UpdateAffinityGroupRequest,
): Promise<AffinityGroupReferenceSummary | null> {
  assertActionAccess(actor.role, 'reference.manage');

  const current = await prisma.affinityGroupRef.findUnique({
    where: { id },
  });
  if (!current) {
    return null;
  }

  const data = buildAffinityGroupUpdateData(input);
  if (Object.keys(data).length === 0) {
    throw new Error('At least one field must be provided');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.affinityGroupRef.update({
      where: { id },
      data,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: AFFINITY_GROUP_ENTITY_TYPE,
        entityId: next.id,
        beforeData: toAffinityGroupAuditPayload(current),
        afterData: toAffinityGroupAuditPayload(next),
        metadata: baseReferenceAuditMetadata(actor),
      }),
    });

    return next;
  });

  return toAffinityGroupReferenceSummary(updated);
}

export async function importAffinityGroups(
  actor: AuthenticatedActor,
  input: ReferenceImportRequest<AffinityGroupImportRow>,
): Promise<ReferenceImportResponse<AffinityGroupReferenceSummary>> {
  assertActionAccess(actor.role, 'reference.manage');

  validateReferenceImportRows(input.rows, 'rows');
  assertUniqueNormalizedGroupCodes(input.rows);

  const batchName = optionalTrimmed(input.batchName);
  const sourceLabel = optionalTrimmed(input.sourceLabel);
  let createdCount = 0;
  let updatedCount = 0;

  const items = await prisma.$transaction(async (tx) => {
    const results: AffinityGroupReferenceSummary[] = [];

    for (const [index, row] of input.rows.entries()) {
      const normalized = normalizeAffinityGroupImportRow(row, index);
      const current = await tx.affinityGroupRef.findUnique({
        where: { code: normalized.code },
      });

      if (current) {
        const next = await tx.affinityGroupRef.update({
          where: { id: current.id },
          data: {
            name: normalized.name,
            ...(normalized.shortName !== undefined ? { shortName: normalized.shortName } : {}),
            ...(normalized.description !== undefined ? { description: normalized.description } : {}),
            groupType: toAffinityGroupTypeEnum(normalized.groupType),
            ...(normalized.isActive !== undefined ? { isActive: normalized.isActive } : {}),
            ...(normalized.sortOrder !== undefined ? { sortOrder: normalized.sortOrder } : {}),
            ...(normalized.notes !== undefined ? { notes: normalized.notes } : {}),
          },
        });

        await tx.auditEntry.create({
          data: buildAuditEntryData({
            actorUserId: actor.userId,
            action: AuditAction.UPDATE,
            entityType: AFFINITY_GROUP_ENTITY_TYPE,
            entityId: next.id,
            beforeData: toAffinityGroupAuditPayload(current),
            afterData: toAffinityGroupAuditPayload(next),
            metadata: buildReferenceImportAuditMetadata(actor, batchName, sourceLabel, index),
          }),
        });

        results.push(toAffinityGroupReferenceSummary(next));
        updatedCount += 1;
        continue;
      }

      const next = await tx.affinityGroupRef.create({
        data: {
          code: normalized.code,
          name: normalized.name,
          ...(normalized.shortName !== undefined ? { shortName: normalized.shortName } : {}),
          ...(normalized.description !== undefined ? { description: normalized.description } : {}),
          groupType: toAffinityGroupTypeEnum(normalized.groupType),
          isActive: normalized.isActive ?? true,
          sortOrder: normalized.sortOrder ?? 0,
          ...(normalized.notes !== undefined ? { notes: normalized.notes } : {}),
        },
      });

      await tx.auditEntry.create({
        data: buildAuditEntryData({
          actorUserId: actor.userId,
          action: AuditAction.CREATE,
          entityType: AFFINITY_GROUP_ENTITY_TYPE,
          entityId: next.id,
          afterData: toAffinityGroupAuditPayload(next),
          metadata: buildReferenceImportAuditMetadata(actor, batchName, sourceLabel, index),
        }),
      });

      results.push(toAffinityGroupReferenceSummary(next));
      createdCount += 1;
    }

    return results;
  });

  return {
    ...(batchName !== undefined ? { batchName } : {}),
    ...(sourceLabel !== undefined ? { sourceLabel } : {}),
    processedCount: input.rows.length,
    createdCount,
    updatedCount,
    items,
  };
}

export async function createOwnershipGroup(
  actor: AuthenticatedActor,
  input: CreateOwnershipGroupRequest,
): Promise<OwnershipGroupReferenceSummary> {
  assertActionAccess(actor.role, 'reference.manage');

  const normalized = normalizeOwnershipGroupCreateInput(input);

  const created = await prisma.$transaction(async (tx) => {
    const next = await tx.ownershipGroupRef.create({
      data: {
        code: normalized.code,
        name: normalized.name,
        ...(normalized.shortName !== undefined ? { shortName: normalized.shortName } : {}),
        ...(normalized.description !== undefined ? { description: normalized.description } : {}),
        ownershipType: toOwnershipGroupTypeEnum(normalized.ownershipType),
        isActive: normalized.isActive ?? true,
        sortOrder: normalized.sortOrder ?? 0,
        ...(normalized.notes !== undefined ? { notes: normalized.notes } : {}),
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: OWNERSHIP_GROUP_ENTITY_TYPE,
        entityId: next.id,
        afterData: toOwnershipGroupAuditPayload(next),
        metadata: baseReferenceAuditMetadata(actor),
      }),
    });

    return next;
  });

  return toOwnershipGroupReferenceSummary(created);
}

export async function updateOwnershipGroup(
  actor: AuthenticatedActor,
  id: string,
  input: UpdateOwnershipGroupRequest,
): Promise<OwnershipGroupReferenceSummary | null> {
  assertActionAccess(actor.role, 'reference.manage');

  const current = await prisma.ownershipGroupRef.findUnique({
    where: { id },
  });
  if (!current) {
    return null;
  }

  const data = buildOwnershipGroupUpdateData(input);
  if (Object.keys(data).length === 0) {
    throw new Error('At least one field must be provided');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.ownershipGroupRef.update({
      where: { id },
      data,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: OWNERSHIP_GROUP_ENTITY_TYPE,
        entityId: next.id,
        beforeData: toOwnershipGroupAuditPayload(current),
        afterData: toOwnershipGroupAuditPayload(next),
        metadata: baseReferenceAuditMetadata(actor),
      }),
    });

    return next;
  });

  return toOwnershipGroupReferenceSummary(updated);
}

export async function importOwnershipGroups(
  actor: AuthenticatedActor,
  input: ReferenceImportRequest<OwnershipGroupImportRow>,
): Promise<ReferenceImportResponse<OwnershipGroupReferenceSummary>> {
  assertActionAccess(actor.role, 'reference.manage');

  validateReferenceImportRows(input.rows, 'rows');
  assertUniqueNormalizedGroupCodes(input.rows);

  const batchName = optionalTrimmed(input.batchName);
  const sourceLabel = optionalTrimmed(input.sourceLabel);
  let createdCount = 0;
  let updatedCount = 0;

  const items = await prisma.$transaction(async (tx) => {
    const results: OwnershipGroupReferenceSummary[] = [];

    for (const [index, row] of input.rows.entries()) {
      const normalized = normalizeOwnershipGroupImportRow(row, index);
      const current = await tx.ownershipGroupRef.findUnique({
        where: { code: normalized.code },
      });

      if (current) {
        const next = await tx.ownershipGroupRef.update({
          where: { id: current.id },
          data: {
            name: normalized.name,
            ...(normalized.shortName !== undefined ? { shortName: normalized.shortName } : {}),
            ...(normalized.description !== undefined ? { description: normalized.description } : {}),
            ownershipType: toOwnershipGroupTypeEnum(normalized.ownershipType),
            ...(normalized.isActive !== undefined ? { isActive: normalized.isActive } : {}),
            ...(normalized.sortOrder !== undefined ? { sortOrder: normalized.sortOrder } : {}),
            ...(normalized.notes !== undefined ? { notes: normalized.notes } : {}),
          },
        });

        await tx.auditEntry.create({
          data: buildAuditEntryData({
            actorUserId: actor.userId,
            action: AuditAction.UPDATE,
            entityType: OWNERSHIP_GROUP_ENTITY_TYPE,
            entityId: next.id,
            beforeData: toOwnershipGroupAuditPayload(current),
            afterData: toOwnershipGroupAuditPayload(next),
            metadata: buildReferenceImportAuditMetadata(actor, batchName, sourceLabel, index),
          }),
        });

        results.push(toOwnershipGroupReferenceSummary(next));
        updatedCount += 1;
        continue;
      }

      const next = await tx.ownershipGroupRef.create({
        data: {
          code: normalized.code,
          name: normalized.name,
          ...(normalized.shortName !== undefined ? { shortName: normalized.shortName } : {}),
          ...(normalized.description !== undefined ? { description: normalized.description } : {}),
          ownershipType: toOwnershipGroupTypeEnum(normalized.ownershipType),
          isActive: normalized.isActive ?? true,
          sortOrder: normalized.sortOrder ?? 0,
          ...(normalized.notes !== undefined ? { notes: normalized.notes } : {}),
        },
      });

      await tx.auditEntry.create({
        data: buildAuditEntryData({
          actorUserId: actor.userId,
          action: AuditAction.CREATE,
          entityType: OWNERSHIP_GROUP_ENTITY_TYPE,
          entityId: next.id,
          afterData: toOwnershipGroupAuditPayload(next),
          metadata: buildReferenceImportAuditMetadata(actor, batchName, sourceLabel, index),
        }),
      });

      results.push(toOwnershipGroupReferenceSummary(next));
      createdCount += 1;
    }

    return results;
  });

  return {
    ...(batchName !== undefined ? { batchName } : {}),
    ...(sourceLabel !== undefined ? { sourceLabel } : {}),
    processedCount: input.rows.length,
    createdCount,
    updatedCount,
    items,
  };
}

export async function createLeadSource(
  actor: AuthenticatedActor,
  input: CreateLeadSourceRequest,
): Promise<ReferenceValueSummary> {
  assertActionAccess(actor.role, 'reference.manage');

  const code = normalizeGroupReferenceCode(input.code);
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

export async function importLeadSources(
  actor: AuthenticatedActor,
  input: ReferenceImportRequest<LeadSourceImportRow>,
): Promise<ReferenceImportResponse<ReferenceValueSummary>> {
  assertActionAccess(actor.role, 'reference.manage');

  validateReferenceImportRows(input.rows, 'rows');
  assertUniqueNormalizedCodes(input.rows);

  const batchName = optionalTrimmed(input.batchName);
  const sourceLabel = optionalTrimmed(input.sourceLabel);
  let createdCount = 0;
  let updatedCount = 0;

  const items = await prisma.$transaction(async (tx) => {
    const results: ReferenceValueSummary[] = [];

    for (const [index, row] of input.rows.entries()) {
      const normalized = normalizeLeadSourceImportRow(row, index);
      const current = await tx.leadSourceRef.findUnique({
        where: {
          code: normalized.code,
        },
      });

      if (current) {
        const next = await tx.leadSourceRef.update({
          where: { id: current.id },
          data: {
            name: normalized.name,
            ...(normalized.description !== undefined ? { description: normalized.description } : {}),
            ...(normalized.isActive !== undefined ? { isActive: normalized.isActive } : {}),
            ...(normalized.sortOrder !== undefined ? { sortOrder: normalized.sortOrder } : {}),
          },
        });

        await tx.auditEntry.create({
          data: buildAuditEntryData({
            actorUserId: actor.userId,
            action: AuditAction.UPDATE,
            entityType: LEAD_SOURCE_ENTITY_TYPE,
            entityId: next.id,
            beforeData: toReferenceValueAuditPayload(current),
            afterData: toReferenceValueAuditPayload(next),
            metadata: buildReferenceImportAuditMetadata(actor, batchName, sourceLabel, index),
          }),
        });

        results.push(toReferenceValueSummary(next));
        updatedCount += 1;
        continue;
      }

      const next = await tx.leadSourceRef.create({
        data: {
          code: normalized.code,
          name: normalized.name,
          ...(normalized.description !== undefined ? { description: normalized.description } : {}),
          isActive: normalized.isActive ?? true,
          sortOrder: normalized.sortOrder ?? 0,
        },
      });

      await tx.auditEntry.create({
        data: buildAuditEntryData({
          actorUserId: actor.userId,
          action: AuditAction.CREATE,
          entityType: LEAD_SOURCE_ENTITY_TYPE,
          entityId: next.id,
          afterData: toReferenceValueAuditPayload(next),
          metadata: buildReferenceImportAuditMetadata(actor, batchName, sourceLabel, index),
        }),
      });

      results.push(toReferenceValueSummary(next));
      createdCount += 1;
    }

    return results;
  });

  return {
    ...(batchName !== undefined ? { batchName } : {}),
    ...(sourceLabel !== undefined ? { sourceLabel } : {}),
    processedCount: input.rows.length,
    createdCount,
    updatedCount,
    items,
  };
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

export async function importLeadStages(
  actor: AuthenticatedActor,
  input: ReferenceImportRequest<LeadStageImportRow>,
): Promise<ReferenceImportResponse<LeadStageReferenceSummary>> {
  assertActionAccess(actor.role, 'reference.manage');

  validateReferenceImportRows(input.rows, 'rows');
  assertUniqueLeadStages(input.rows);

  const batchName = optionalTrimmed(input.batchName);
  const sourceLabel = optionalTrimmed(input.sourceLabel);
  let createdCount = 0;
  let updatedCount = 0;

  const items = await prisma.$transaction(async (tx) => {
    const results: LeadStageReferenceSummary[] = [];

    for (const [index, row] of input.rows.entries()) {
      const normalized = normalizeLeadStageImportRow(row, index);
      const stage = toLeadStageEnum(normalized.stage);
      const current = await tx.leadStageRef.findUnique({
        where: {
          stage,
        },
      });

      if (current) {
        const next = await tx.leadStageRef.update({
          where: { id: current.id },
          data: {
            name: normalized.name,
            ...(normalized.dashboardLabel !== undefined ? { dashboardLabel: normalized.dashboardLabel } : {}),
            ...(normalized.description !== undefined ? { description: normalized.description } : {}),
            ...(normalized.isActive !== undefined ? { isActive: normalized.isActive } : {}),
            ...(normalized.isTerminal !== undefined ? { isTerminal: normalized.isTerminal } : {}),
            ...(normalized.sortOrder !== undefined ? { sortOrder: normalized.sortOrder } : {}),
          },
        });

        await tx.auditEntry.create({
          data: buildAuditEntryData({
            actorUserId: actor.userId,
            action: AuditAction.UPDATE,
            entityType: LEAD_STAGE_ENTITY_TYPE,
            entityId: next.id,
            beforeData: toLeadStageAuditPayload(current),
            afterData: toLeadStageAuditPayload(next),
            metadata: buildReferenceImportAuditMetadata(actor, batchName, sourceLabel, index),
          }),
        });

        results.push(toLeadStageReferenceSummary(next));
        updatedCount += 1;
        continue;
      }

      const next = await tx.leadStageRef.create({
        data: {
          stage,
          code: normalized.stage,
          name: normalized.name,
          ...(normalized.dashboardLabel !== undefined ? { dashboardLabel: normalized.dashboardLabel } : {}),
          ...(normalized.description !== undefined ? { description: normalized.description } : {}),
          isActive: normalized.isActive ?? true,
          isTerminal: normalized.isTerminal ?? normalized.stage === 'customer_active',
          sortOrder: normalized.sortOrder ?? defaultLeadStageSortOrder(normalized.stage),
        },
      });

      await tx.auditEntry.create({
        data: buildAuditEntryData({
          actorUserId: actor.userId,
          action: AuditAction.CREATE,
          entityType: LEAD_STAGE_ENTITY_TYPE,
          entityId: next.id,
          afterData: toLeadStageAuditPayload(next),
          metadata: buildReferenceImportAuditMetadata(actor, batchName, sourceLabel, index),
        }),
      });

      results.push(toLeadStageReferenceSummary(next));
      createdCount += 1;
    }

    return results;
  });

  return {
    ...(batchName !== undefined ? { batchName } : {}),
    ...(sourceLabel !== undefined ? { sourceLabel } : {}),
    processedCount: input.rows.length,
    createdCount,
    updatedCount,
    items,
  };
}

export async function updateLeadStage(
  actor: AuthenticatedActor,
  id: string,
  input: UpdateLeadStageReferenceRequest,
): Promise<LeadStageReferenceSummary | null> {
  assertActionAccess(actor.role, 'reference.manage');

  const current = await prisma.leadStageRef.findUnique({
    where: { id },
  });
  if (!current) {
    return null;
  }

  const data = buildLeadStageUpdateData(input);
  if (Object.keys(data).length === 0) {
    throw new Error('At least one field must be provided');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.leadStageRef.update({
      where: { id },
      data,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: LEAD_STAGE_ENTITY_TYPE,
        entityId: next.id,
        beforeData: toLeadStageAuditPayload(current),
        afterData: toLeadStageAuditPayload(next),
        metadata: baseReferenceAuditMetadata(actor),
      }),
    });

    return next;
  });

  return toLeadStageReferenceSummary(updated);
}

function buildReferenceValueUpdateData(input: UpdateReferenceValueRequest) {
  const data: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  } = {};

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

function buildAffinityGroupUpdateData(input: UpdateAffinityGroupRequest) {
  const data: {
    name?: string;
    shortName?: string | null;
    description?: string | null;
    groupType?: import('@pulse/db').AffinityGroupType;
    isActive?: boolean;
    sortOrder?: number;
    notes?: string | null;
  } = buildReferenceValueUpdateData(input);

  if (input.shortName !== undefined) {
    data.shortName = optionalTrimmed(input.shortName) ?? null;
  }
  if (input.groupType !== undefined) {
    data.groupType = toAffinityGroupTypeEnum(input.groupType);
  }
  if (input.notes !== undefined) {
    data.notes = optionalTrimmed(input.notes) ?? null;
  }

  return data;
}

function buildOwnershipGroupUpdateData(input: UpdateOwnershipGroupRequest) {
  const data: {
    name?: string;
    shortName?: string | null;
    description?: string | null;
    ownershipType?: import('@pulse/db').OwnershipGroupType;
    isActive?: boolean;
    sortOrder?: number;
    notes?: string | null;
  } = buildReferenceValueUpdateData(input);

  if (input.shortName !== undefined) {
    data.shortName = optionalTrimmed(input.shortName) ?? null;
  }
  if (input.ownershipType !== undefined) {
    data.ownershipType = toOwnershipGroupTypeEnum(input.ownershipType);
  }
  if (input.notes !== undefined) {
    data.notes = optionalTrimmed(input.notes) ?? null;
  }

  return data;
}

function buildLeadStageUpdateData(input: UpdateLeadStageReferenceRequest) {
  const data: {
    name?: string;
    description?: string | null;
    dashboardLabel?: string | null;
    isActive?: boolean;
    isTerminal?: boolean;
    sortOrder?: number;
  } = {};

  const name = input.name?.trim();
  if (name) {
    data.name = name;
  }

  if (input.description !== undefined) {
    data.description = optionalTrimmed(input.description) ?? null;
  }
  if (input.dashboardLabel !== undefined) {
    data.dashboardLabel = optionalTrimmed(input.dashboardLabel) ?? null;
  }
  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }
  if (input.isTerminal !== undefined) {
    data.isTerminal = input.isTerminal;
  }
  if (input.sortOrder !== undefined) {
    data.sortOrder = normalizeSortOrder(input.sortOrder);
  }

  return data;
}

function normalizeLeadSourceImportRow(row: LeadSourceImportRow, rowIndex: number) {
  const code = normalizeGroupReferenceCode(row.code);
  const name = row.name?.trim();
  if (!code) {
    throw new Error(`rows[${rowIndex}].code is required`);
  }
  if (!name) {
    throw new Error(`rows[${rowIndex}].name is required`);
  }

  return {
    code,
    name,
    ...(row.description !== undefined ? { description: optionalTrimmed(row.description) ?? null } : {}),
    ...(row.isActive !== undefined ? { isActive: row.isActive } : {}),
    ...(row.sortOrder !== undefined ? { sortOrder: normalizeSortOrder(row.sortOrder) } : {}),
  };
}

function normalizeAffinityGroupCreateInput(input: CreateAffinityGroupRequest) {
  const code = normalizeGroupReferenceCode(input.code);
  const name = input.name?.trim();
  if (!code) {
    throw new Error('code is required');
  }
  if (!name) {
    throw new Error('name is required');
  }

  return {
    code,
    name,
    ...(input.shortName !== undefined ? { shortName: optionalTrimmed(input.shortName) ?? null } : {}),
    ...(input.description !== undefined ? { description: optionalTrimmed(input.description) ?? null } : {}),
    groupType: input.groupType,
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: normalizeSortOrder(input.sortOrder) } : {}),
    ...(input.notes !== undefined ? { notes: optionalTrimmed(input.notes) ?? null } : {}),
  };
}

function normalizeAffinityGroupImportRow(row: AffinityGroupImportRow, rowIndex: number) {
  const code = normalizeGroupReferenceCode(row.code);
  const name = row.name?.trim();
  if (!code) {
    throw new Error(`rows[${rowIndex}].code is required`);
  }
  if (!name) {
    throw new Error(`rows[${rowIndex}].name is required`);
  }

  return {
    code,
    name,
    ...(row.shortName !== undefined ? { shortName: optionalTrimmed(row.shortName) ?? null } : {}),
    ...(row.description !== undefined ? { description: optionalTrimmed(row.description) ?? null } : {}),
    groupType: row.groupType,
    ...(row.isActive !== undefined ? { isActive: row.isActive } : {}),
    ...(row.sortOrder !== undefined ? { sortOrder: normalizeSortOrder(row.sortOrder) } : {}),
    ...(row.notes !== undefined ? { notes: optionalTrimmed(row.notes) ?? null } : {}),
  };
}

function normalizeOwnershipGroupCreateInput(input: CreateOwnershipGroupRequest) {
  const code = normalizeGroupReferenceCode(input.code);
  const name = input.name?.trim();
  if (!code) {
    throw new Error('code is required');
  }
  if (!name) {
    throw new Error('name is required');
  }

  return {
    code,
    name,
    ...(input.shortName !== undefined ? { shortName: optionalTrimmed(input.shortName) ?? null } : {}),
    ...(input.description !== undefined ? { description: optionalTrimmed(input.description) ?? null } : {}),
    ownershipType: input.ownershipType,
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: normalizeSortOrder(input.sortOrder) } : {}),
    ...(input.notes !== undefined ? { notes: optionalTrimmed(input.notes) ?? null } : {}),
  };
}

function normalizeOwnershipGroupImportRow(row: OwnershipGroupImportRow, rowIndex: number) {
  const code = normalizeGroupReferenceCode(row.code);
  const name = row.name?.trim();
  if (!code) {
    throw new Error(`rows[${rowIndex}].code is required`);
  }
  if (!name) {
    throw new Error(`rows[${rowIndex}].name is required`);
  }

  return {
    code,
    name,
    ...(row.shortName !== undefined ? { shortName: optionalTrimmed(row.shortName) ?? null } : {}),
    ...(row.description !== undefined ? { description: optionalTrimmed(row.description) ?? null } : {}),
    ownershipType: row.ownershipType,
    ...(row.isActive !== undefined ? { isActive: row.isActive } : {}),
    ...(row.sortOrder !== undefined ? { sortOrder: normalizeSortOrder(row.sortOrder) } : {}),
    ...(row.notes !== undefined ? { notes: optionalTrimmed(row.notes) ?? null } : {}),
  };
}

function normalizeLeadStageImportRow(row: LeadStageImportRow, rowIndex: number) {
  const name = row.name?.trim();
  if (!name) {
    throw new Error(`rows[${rowIndex}].name is required`);
  }

  return {
    stage: row.stage,
    name,
    ...(row.dashboardLabel !== undefined ? { dashboardLabel: optionalTrimmed(row.dashboardLabel) ?? null } : {}),
    ...(row.description !== undefined ? { description: optionalTrimmed(row.description) ?? null } : {}),
    ...(row.isActive !== undefined ? { isActive: row.isActive } : {}),
    ...(row.isTerminal !== undefined ? { isTerminal: row.isTerminal } : {}),
    ...(row.sortOrder !== undefined ? { sortOrder: normalizeSortOrder(row.sortOrder) } : {}),
  };
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

function toLeadStageReferenceSummary(value: {
  id: string;
  stage: LeadStage;
  code: string;
  name: string;
  dashboardLabel: string | null;
  description: string | null;
  isActive: boolean;
  isTerminal: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): LeadStageReferenceSummary {
  const summary: LeadStageReferenceSummary = {
    id: value.id,
    stage: toLeadStageKey(value.stage),
    code: value.code,
    name: value.name,
    isActive: value.isActive,
    isTerminal: value.isTerminal,
    sortOrder: value.sortOrder,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };

  if (value.dashboardLabel) {
    summary.dashboardLabel = value.dashboardLabel;
  }
  if (value.description) {
    summary.description = value.description;
  }

  return summary;
}

function toBrandLabelReferenceSummary(value: {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}): BrandLabelReferenceSummary {
  return {
    id: value.id,
    code: value.code,
    name: value.name,
    isActive: value.isActive,
    sortOrder: value.sortOrder,
  };
}

function toAffinityGroupReferenceSummary(value: {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  description: string | null;
  groupType: import('@pulse/db').AffinityGroupType;
  isActive: boolean;
  sortOrder: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AffinityGroupReferenceSummary {
  const summary: AffinityGroupReferenceSummary = {
    ...toReferenceValueSummary(value),
    groupType: toAffinityGroupTypeKey(value.groupType),
  };

  if (value.shortName) {
    summary.shortName = value.shortName;
  }
  if (value.notes) {
    summary.notes = value.notes;
  }

  return summary;
}

function toOwnershipGroupReferenceSummary(value: {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  description: string | null;
  ownershipType: import('@pulse/db').OwnershipGroupType;
  isActive: boolean;
  sortOrder: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): OwnershipGroupReferenceSummary {
  const summary: OwnershipGroupReferenceSummary = {
    ...toReferenceValueSummary(value),
    ownershipType: toOwnershipGroupTypeKey(value.ownershipType),
  };

  if (value.shortName) {
    summary.shortName = value.shortName;
  }
  if (value.notes) {
    summary.notes = value.notes;
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

function toAffinityGroupAuditPayload(value: {
  code: string;
  name: string;
  shortName: string | null;
  description: string | null;
  groupType: import('@pulse/db').AffinityGroupType;
  isActive: boolean;
  sortOrder: number;
  notes: string | null;
}) {
  return {
    ...toReferenceValueAuditPayload(value),
    shortName: value.shortName,
    groupType: toAffinityGroupTypeKey(value.groupType),
    notes: value.notes,
  };
}

function toOwnershipGroupAuditPayload(value: {
  code: string;
  name: string;
  shortName: string | null;
  description: string | null;
  ownershipType: import('@pulse/db').OwnershipGroupType;
  isActive: boolean;
  sortOrder: number;
  notes: string | null;
}) {
  return {
    ...toReferenceValueAuditPayload(value),
    shortName: value.shortName,
    ownershipType: toOwnershipGroupTypeKey(value.ownershipType),
    notes: value.notes,
  };
}

function toLeadStageAuditPayload(value: {
  stage: LeadStage;
  code: string;
  name: string;
  dashboardLabel: string | null;
  description: string | null;
  isActive: boolean;
  isTerminal: boolean;
  sortOrder: number;
}) {
  return {
    stage: toLeadStageKey(value.stage),
    code: value.code,
    name: value.name,
    dashboardLabel: value.dashboardLabel,
    description: value.description,
    isActive: value.isActive,
    isTerminal: value.isTerminal,
    sortOrder: value.sortOrder,
  };
}

function toAffinityGroupTypeEnum(value: AffinityGroupTypeKey) {
  switch (value) {
    case 'buying_group':
      return 'BUYING_GROUP';
    case 'coaching_network':
      return 'COACHING_NETWORK';
    case 'franchise':
      return 'FRANCHISE';
    case 'community':
      return 'COMMUNITY';
    case 'other':
      return 'OTHER';
  }
}

function toOwnershipGroupTypeEnum(value: OwnershipGroupTypeKey) {
  switch (value) {
    case 'private_equity':
      return 'PRIVATE_EQUITY';
    case 'common_owner':
      return 'COMMON_OWNER';
    case 'franchise_system':
      return 'FRANCHISE_SYSTEM';
    case 'other':
      return 'OTHER';
  }
}

function toAffinityGroupTypeKey(value: import('@pulse/db').AffinityGroupType): AffinityGroupTypeKey {
  switch (value) {
    case 'BUYING_GROUP':
      return 'buying_group';
    case 'COACHING_NETWORK':
      return 'coaching_network';
    case 'FRANCHISE':
      return 'franchise';
    case 'COMMUNITY':
      return 'community';
    case 'OTHER':
      return 'other';
  }
}

function toOwnershipGroupTypeKey(value: import('@pulse/db').OwnershipGroupType): OwnershipGroupTypeKey {
  switch (value) {
    case 'PRIVATE_EQUITY':
      return 'private_equity';
    case 'COMMON_OWNER':
      return 'common_owner';
    case 'FRANCHISE_SYSTEM':
      return 'franchise_system';
    case 'OTHER':
      return 'other';
  }
}

function baseReferenceAuditMetadata(actor: AuthenticatedActor) {
  return {
    sessionId: actor.sessionId,
    actorRole: actor.role,
    actorType: actor.actorType,
  };
}

function buildReferenceImportAuditMetadata(
  actor: AuthenticatedActor,
  batchName: string | undefined,
  sourceLabel: string | undefined,
  rowIndex: number,
) {
  return {
    ...baseReferenceAuditMetadata(actor),
    importMode: 'reference_import',
    rowIndex,
    ...(batchName !== undefined ? { batchName } : {}),
    ...(sourceLabel !== undefined ? { sourceLabel } : {}),
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

function normalizeGroupReferenceCode(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
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

function validateReferenceImportRows(rows: unknown[], fieldName: string) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`${fieldName} must contain at least one item`);
  }
  if (rows.length > 200) {
    throw new Error(`${fieldName} cannot exceed 200 items`);
  }
}

function assertUniqueNormalizedCodes(rows: LeadSourceImportRow[]) {
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const code = normalizeReferenceCode(row.code);
    if (!code) {
      continue;
    }
    if (seen.has(code)) {
      throw new Error(`rows[${index}].code duplicates another row: ${code}`);
    }
    seen.add(code);
  }
}

function assertUniqueNormalizedGroupCodes(rows: Array<{ code: string }>) {
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const code = normalizeGroupReferenceCode(row.code);
    if (!code) {
      continue;
    }
    if (seen.has(code)) {
      throw new Error(`rows[${index}].code duplicates another row: ${code}`);
    }
    seen.add(code);
  }
}

function assertUniqueLeadStages(rows: LeadStageImportRow[]) {
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    if (seen.has(row.stage)) {
      throw new Error(`rows[${index}].stage duplicates another row: ${row.stage}`);
    }
    seen.add(row.stage);
  }
}

function defaultLeadStageSortOrder(stage: LeadStageReferenceSummary['stage']) {
  switch (stage) {
    case 'new':
      return 10;
    case 'discovery_scheduled':
      return 20;
    case 'discovery_completed':
      return 30;
    case 'cis_sent':
      return 40;
    case 'cis_signed':
      return 50;
    case 'onboarding_completed':
      return 60;
    case 'customer_active':
      return 70;
  }
}

function toLeadStageKey(stage: LeadStage) {
  switch (stage) {
    case LeadStage.NEW:
      return 'new';
    case LeadStage.DISCOVERY_SCHEDULED:
      return 'discovery_scheduled';
    case LeadStage.DISCOVERY_COMPLETED:
      return 'discovery_completed';
    case LeadStage.CIS_SENT:
      return 'cis_sent';
    case LeadStage.CIS_SIGNED:
      return 'cis_signed';
    case LeadStage.ONBOARDING_COMPLETED:
      return 'onboarding_completed';
    case LeadStage.CUSTOMER_ACTIVE:
      return 'customer_active';
  }
}

function toLeadStageEnum(stage: LeadStageReferenceSummary['stage']) {
  switch (stage) {
    case 'new':
      return LeadStage.NEW;
    case 'discovery_scheduled':
      return LeadStage.DISCOVERY_SCHEDULED;
    case 'discovery_completed':
      return LeadStage.DISCOVERY_COMPLETED;
    case 'cis_sent':
      return LeadStage.CIS_SENT;
    case 'cis_signed':
      return LeadStage.CIS_SIGNED;
    case 'onboarding_completed':
      return LeadStage.ONBOARDING_COMPLETED;
    case 'customer_active':
      return LeadStage.CUSTOMER_ACTIVE;
  }
}
