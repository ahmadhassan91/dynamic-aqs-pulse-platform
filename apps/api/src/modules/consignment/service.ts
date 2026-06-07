import {
  assertActionAccess,
  assertModuleAccess,
} from '@pulse/auth';
import {
  AuditAction,
  ConsignmentAcumaticaStatus,
  ConsignmentAdjustmentStatus,
  ConsignmentAuditEvidencePurpose,
  ConsignmentAuditStatus,
  ConsignmentDiscrepancyStatus,
  ConsignmentExitStatus,
  ConsignmentFormStatus,
  ConsignmentFormType,
  ConsignmentPoFollowUpStatus,
  ConsignmentReconciliationStatus,
  ConsignmentSiteStatus,
  ConsignmentWorkItemStatus,
  ConsignmentWorkItemType,
  MobileVoiceNoteReviewStatus,
  Prisma,
  prisma,
} from '@pulse/db';
import type {
  ApplyConsignmentAdjustmentRequest,
  ConfirmConsignmentTrueUpRequest,
  ConfirmConsignmentTrueUpResponse,
  CompleteConsignmentAuditRequest,
  CloseConsignmentExitRequest,
  ConsignmentAccountReadModel,
  ConsignmentAdjustmentSummary,
  ConsignmentAuditEvidenceSummary,
  ConsignmentAuditEvidencePurposeKey,
  ConsignmentAuditSummary,
  ConsignmentDiscrepancyCaseSummary,
  ConsignmentExitSummary,
  ConsignmentFieldActivityNoteSummary,
  ConsignmentFormStatusKey,
  ConsignmentFormSummary,
  ConsignmentFormTypeKey,
  ConsignmentOperationalQueueRequest,
  ConsignmentOperationalQueueResponse,
  ConsignmentReadinessItemSummary,
  ConsignmentSiteDetail,
  ConsignmentSiteStatusKey,
  ConsignmentSiteSummary,
  CreateConsignmentAdjustmentRequest,
  CreateConsignmentAuditRequest,
  CreateConsignmentSiteRequest,
  StartConsignmentExitRequest,
  ListConsignmentSitesRequest,
  MarkConsignmentPoReceivedRequest,
  ListConsignmentSitesResponse,
  UpdateConsignmentAuditRequest,
  UpdateConsignmentDocumentRequest,
  UpdateConsignmentSiteRequest,
  UploadConsignmentAuditEvidenceRequest,
  UploadConsignmentAuditEvidenceResponse,
  UpsertConsignmentDocumentRequest,
} from '@pulse/contracts/consignment';
import type { AppConfig } from '../../config.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import type { AuthenticatedActor } from '../auth/types.js';
import { storeBase64Document } from '../documents/storage.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const ROSE_CADENCE_DAYS = 90;
const PO_CLOCK_BUSINESS_DAYS = 5;
const CONSIGNMENT_EVIDENCE_MAX_BYTES = 4 * 1024 * 1024;
const CONSIGNMENT_EVIDENCE_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const ACTIVATION_READY_FORM_STATUSES = new Set<ConsignmentFormStatus>([
  ConsignmentFormStatus.SIGNED,
  ConsignmentFormStatus.APPROVED,
  ConsignmentFormStatus.CURRENT,
]);

const SITE_INCLUDE = {
  account: {
    select: {
      id: true,
      displayName: true,
      assignedTmUserId: true,
      assignedRdUserId: true,
      territoryId: true,
      shippingCenterId: true,
      territory: { select: { id: true, name: true, regionId: true, region: { select: { id: true, name: true } } } },
      shippingCenter: { select: { id: true, name: true } },
    },
  },
  location: { select: { id: true, name: true, city: true, state: true } },
  ownerTmUser: { select: { id: true, displayName: true } },
  ownerRdUser: { select: { id: true, displayName: true } },
  territory: { select: { id: true, name: true } },
  region: { select: { id: true, name: true } },
  shippingCenter: { select: { id: true, name: true } },
  forms: { orderBy: [{ createdAt: 'desc' }] },
  audits: { include: { lines: { orderBy: [{ createdAt: 'asc' }] }, evidence: { orderBy: [{ uploadedAt: 'desc' }] } }, orderBy: [{ scheduledFor: 'desc' }], take: 10 },
  workItems: { orderBy: [{ createdAt: 'desc' }], take: 25 },
  discrepancyCases: { orderBy: [{ createdAt: 'desc' }], take: 25 },
  adjustments: { orderBy: [{ createdAt: 'desc' }], take: 25 },
  exits: { orderBy: [{ createdAt: 'desc' }], take: 10 },
  mobileVoiceNotes: {
    where: { reviewStatus: MobileVoiceNoteReviewStatus.APPROVED },
    include: {
      createdBy: { select: { displayName: true } },
      reviewedBy: { select: { displayName: true } },
    },
    orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }],
    take: 5,
  },
  _count: {
    select: {
      forms: true,
      workItems: { where: { status: { in: [ConsignmentWorkItemStatus.OPEN, ConsignmentWorkItemStatus.IN_PROGRESS, ConsignmentWorkItemStatus.BLOCKED] } } },
      discrepancyCases: { where: { status: { in: [ConsignmentDiscrepancyStatus.OPEN, ConsignmentDiscrepancyStatus.IN_REVIEW, ConsignmentDiscrepancyStatus.PO_REQUIRED] } } },
    },
  },
} satisfies Prisma.ConsignmentSiteInclude;

type SiteWithRelations = Prisma.ConsignmentSiteGetPayload<{ include: typeof SITE_INCLUDE }>;

export class ConsignmentPersistenceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConsignmentPersistenceUnavailableError';
  }
}

export async function listConsignmentSites(actor: AuthenticatedActor, input: ListConsignmentSitesRequest = {}): Promise<ListConsignmentSitesResponse> {
  assertConsignmentAccess(actor);
  const where = buildSiteWhere(actor, input);
  const [items, total] = await Promise.all([
    prisma.consignmentSite.findMany({ where, include: SITE_INCLUDE, orderBy: [{ nextAuditDueAt: 'asc' }, { updatedAt: 'desc' }], take: clampLimit(input.limit) }),
    prisma.consignmentSite.count({ where }),
  ]);
  return { items: items.map(mapSiteSummary), total };
}

export async function getConsignmentSiteDetail(actor: AuthenticatedActor, siteId: string): Promise<ConsignmentSiteDetail | null> {
  assertConsignmentAccess(actor);
  const site = await prisma.consignmentSite.findFirst({ where: { AND: [{ id: siteId }, siteScopeWhere(actor)] }, include: SITE_INCLUDE });
  return site ? mapSiteDetail(site) : null;
}

export async function getAccountConsignmentReadModel(actor: AuthenticatedActor, accountId: string): Promise<ConsignmentAccountReadModel | null> {
  assertConsignmentAccess(actor);
  const scopedWhere = { AND: [{ accountId }, siteScopeWhere(actor)] } satisfies Prisma.ConsignmentSiteWhereInput;
  const [account, sites, activeSiteCount, onboardingSiteCount, exitedSiteCount] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId }, select: { id: true } }),
    prisma.consignmentSite.findMany({
      where: scopedWhere,
      include: SITE_INCLUDE,
      orderBy: [{ nextAuditDueAt: 'asc' }, { updatedAt: 'desc' }],
      take: MAX_LIMIT,
    }),
    prisma.consignmentSite.count({ where: { AND: [scopedWhere, { status: ConsignmentSiteStatus.ACTIVE }] } }),
    prisma.consignmentSite.count({ where: { AND: [scopedWhere, { status: { notIn: [ConsignmentSiteStatus.ACTIVE, ConsignmentSiteStatus.EXITED] } }] } }),
    prisma.consignmentSite.count({ where: { AND: [scopedWhere, { status: ConsignmentSiteStatus.EXITED }] } }),
  ]);
  if (!account) return null;
  if (isScopedConsignmentRole(actor) && activeSiteCount + onboardingSiteCount + exitedSiteCount === 0) return null;
  return {
    accountId,
    participatesInConsignment: activeSiteCount + onboardingSiteCount + exitedSiteCount > 0,
    activeSiteCount,
    onboardingSiteCount,
    exitedSiteCount,
    sites: sites.map(mapSiteSummary),
  };
}

export async function listConsignmentOperationalQueue(actor: AuthenticatedActor, input: ConsignmentOperationalQueueRequest = {}): Promise<ConsignmentOperationalQueueResponse> {
  assertConsignmentAccess(actor);
  const where = buildOperationalQueueWhere(actor, input);
  const [items, total] = await Promise.all([
    prisma.consignmentSite.findMany({
      where,
      include: SITE_INCLUDE,
      orderBy: [{ nextAuditDueAt: 'asc' }, { updatedAt: 'desc' }],
      take: clampLimit(input.limit),
    }),
    prisma.consignmentSite.count({ where }),
  ]);
  return { items: items.map(mapSiteSummary), total, generatedAt: new Date().toISOString() };
}

export async function createConsignmentSite(actor: AuthenticatedActor, input: CreateConsignmentSiteRequest): Promise<ConsignmentSiteDetail> {
  assertConsignmentManage(actor);
  if (!input.accountId) throw new Error('accountId is required');
  const account = await prisma.account.findUnique({
    where: { id: input.accountId },
    include: { territory: { select: { id: true, regionId: true } } },
  });
  if (!account) throw new Error('Account not found');
  if (input.locationId) {
    const location = await prisma.accountLocation.findFirst({ where: { id: input.locationId, accountId: input.accountId }, select: { id: true } });
    if (!location) throw new Error('locationId must belong to the selected account');
  }
  const site = await prisma.$transaction(async (tx) => {
    const created = await tx.consignmentSite.create({
      data: compact({
        accountId: account.id,
        locationId: cleanOptional(input.locationId),
        name: cleanOptional(input.name) ?? `${account.displayName} Consignment`,
        status: ConsignmentSiteStatus.ONBOARDING_IN_PROGRESS,
        acumaticaStatus: ConsignmentAcumaticaStatus.PARKED,
        warehouseCode: cleanOptional(input.warehouseCode),
        ownerTmUserId: cleanOptional(input.ownerTmUserId) ?? account.assignedTmUserId,
        ownerRdUserId: cleanOptional(input.ownerRdUserId) ?? account.assignedRdUserId,
        territoryId: account.territoryId,
        regionId: account.territory?.regionId,
        shippingCenterId: account.shippingCenterId,
        primaryContactName: cleanOptional(input.primaryContactName),
        primaryContactEmail: cleanOptional(input.primaryContactEmail),
        primaryContactPhone: cleanOptional(input.primaryContactPhone),
        notes: cleanOptional(input.notes),
        createdByUserId: actor.userId,
      }) as any,
      include: SITE_INCLUDE,
    });
    const createdSite = created as SiteWithRelations;
    await tx.auditEntry.create({ data: buildAuditEntryData({ actorUserId: actor.userId, action: AuditAction.CREATE, entityType: 'CONSIGNMENT_SITE', entityId: createdSite.id, afterData: snapshotSite(createdSite), metadata: { acumaticaBoundary: 'parked_until_sandbox_and_certified_mappings' } }) });
    return createdSite;
  });
  return mapSiteDetail(site);
}

export async function updateConsignmentSite(actor: AuthenticatedActor, siteId: string, input: UpdateConsignmentSiteRequest): Promise<ConsignmentSiteDetail> {
  assertConsignmentManage(actor);
  const before = await getSiteForMutation(actor, siteId);
  const nextStatus = input.status ? toSiteStatus(input.status) : undefined;
  if (input.locationId) {
    const location = await prisma.accountLocation.findFirst({ where: { id: input.locationId, accountId: before.accountId }, select: { id: true } });
    if (!location) throw new Error('locationId must belong to the selected account');
  }
  if (nextStatus === ConsignmentSiteStatus.ACTIVE) {
    assertSiteCanActivate(before, input);
  }
  const updated = await prisma.$transaction(async (tx) => {
    const site = await tx.consignmentSite.update({
      where: { id: siteId },
      data: {
        ...(input.name !== undefined ? { name: cleanNullable(input.name) ?? before.name } : {}),
        ...(input.locationId !== undefined ? { locationId: input.locationId } : {}),
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(nextStatus === ConsignmentSiteStatus.ACTIVE ? { activeSince: new Date() } : {}),
        ...(nextStatus === ConsignmentSiteStatus.EXITED ? { exitedAt: new Date() } : {}),
        ...(input.warehouseCode !== undefined ? { warehouseCode: cleanNullable(input.warehouseCode) } : {}),
        ...(input.ownerTmUserId !== undefined ? { ownerTmUserId: input.ownerTmUserId } : {}),
        ...(input.ownerRdUserId !== undefined ? { ownerRdUserId: input.ownerRdUserId } : {}),
        ...(input.primaryContactName !== undefined ? { primaryContactName: cleanNullable(input.primaryContactName) } : {}),
        ...(input.primaryContactEmail !== undefined ? { primaryContactEmail: cleanNullable(input.primaryContactEmail) } : {}),
        ...(input.primaryContactPhone !== undefined ? { primaryContactPhone: cleanNullable(input.primaryContactPhone) } : {}),
        ...(input.notes !== undefined ? { notes: cleanNullable(input.notes) } : {}),
      },
      include: SITE_INCLUDE,
    });
    if (nextStatus === ConsignmentSiteStatus.READY_FOR_WAREHOUSE) {
      await tx.consignmentWorkItem.create({ data: { siteId, type: ConsignmentWorkItemType.WAREHOUSE_SETUP, status: ConsignmentWorkItemStatus.BLOCKED, title: 'Create Acumatica consignment warehouse when access is certified', notes: 'Pulse workflow is ready; ERP warehouse creation remains parked.' } });
    }
    await tx.auditEntry.create({ data: buildAuditEntryData({ actorUserId: actor.userId, action: AuditAction.UPDATE, entityType: 'CONSIGNMENT_SITE', entityId: site.id, beforeData: snapshotSite(before), afterData: snapshotSite(site) }) });
    return site;
  });
  return mapSiteDetail(updated);
}

export async function listConsignmentDocuments(actor: AuthenticatedActor, siteId: string): Promise<ConsignmentFormSummary[] | null> {
  const site = await getConsignmentSiteDetail(actor, siteId);
  return site?.forms ?? null;
}

export async function upsertConsignmentDocument(actor: AuthenticatedActor, siteId: string, input: UpsertConsignmentDocumentRequest): Promise<ConsignmentFormSummary> {
  assertConsignmentDocumentManage(actor);
  await getSiteForMutation(actor, siteId);
  const formType = toFormType(input.formType);
  const formStatus = input.status ? toFormStatus(input.status) : ConsignmentFormStatus.DRAFT;
  const signedAt = parseOptionalDate(input.signedAt);
  const approvedAt = parseOptionalDate(input.approvedAt);
  const form = await prisma.$transaction(async (tx) => {
    if (input.isCurrent !== false) await tx.consignmentForm.updateMany({ where: { siteId, formType, isCurrent: true }, data: { isCurrent: false } });
    const created = await tx.consignmentForm.create({ data: compact({ siteId, formType, status: formStatus, title: cleanOptional(input.title), documentUrl: cleanOptional(input.documentUrl), externalRef: cleanOptional(input.externalRef), version: input.version && input.version > 0 ? input.version : 1, isCurrent: input.isCurrent ?? true, receivedAt: parseOptionalDate(input.receivedAt), signedAt, approvedAt, notes: cleanOptional(input.notes), createdByUserId: actor.userId }) as any });
    if (formType === ConsignmentFormType.BLUE && (signedAt || approvedAt || formStatus === ConsignmentFormStatus.SIGNED || formStatus === ConsignmentFormStatus.APPROVED)) {
      const baselineAt = approvedAt ?? signedAt ?? new Date();
      await tx.consignmentSite.update({ where: { id: siteId }, data: { baselineEstablishedAt: baselineAt, status: ConsignmentSiteStatus.BASELINE_PENDING, nextAuditDueAt: addDays(baselineAt, ROSE_CADENCE_DAYS) } });
    }
    await tx.auditEntry.create({ data: buildAuditEntryData({ actorUserId: actor.userId, action: AuditAction.CREATE, entityType: 'CONSIGNMENT_FORM', entityId: created.id, afterData: created }) });
    return created;
  });
  return mapForm(form);
}

export async function updateConsignmentDocument(actor: AuthenticatedActor, documentId: string, input: UpdateConsignmentDocumentRequest): Promise<ConsignmentFormSummary> {
  assertConsignmentDocumentManage(actor);
  const before = await prisma.consignmentForm.findUnique({ where: { id: documentId } });
  if (!before) throw new Error('Consignment document not found');
  await getSiteForMutation(actor, before.siteId);
  const formStatus = input.status !== undefined ? toFormStatus(input.status) : before.status;
  const signedAt = input.signedAt !== undefined ? parseOptionalDate(input.signedAt) ?? null : before.signedAt;
  const approvedAt = input.approvedAt !== undefined ? parseOptionalDate(input.approvedAt) ?? null : before.approvedAt;
  const updated = await prisma.$transaction(async (tx) => {
    if (input.isCurrent === true) {
      await tx.consignmentForm.updateMany({
        where: { siteId: before.siteId, formType: before.formType, isCurrent: true, id: { not: before.id } },
        data: { isCurrent: false },
      });
    }
    const row = await tx.consignmentForm.update({
      where: { id: documentId },
      data: {
        ...(input.status !== undefined ? { status: formStatus } : {}),
        ...(input.title !== undefined ? { title: cleanNullable(input.title) } : {}),
        ...(input.documentUrl !== undefined ? { documentUrl: cleanNullable(input.documentUrl) } : {}),
        ...(input.externalRef !== undefined ? { externalRef: cleanNullable(input.externalRef) } : {}),
        ...(input.version !== undefined ? { version: Math.max(1, Math.trunc(input.version)) } : {}),
        ...(input.isCurrent !== undefined ? { isCurrent: input.isCurrent } : {}),
        ...(input.receivedAt !== undefined ? { receivedAt: parseOptionalDate(input.receivedAt) ?? null } : {}),
        ...(input.signedAt !== undefined ? { signedAt } : {}),
        ...(input.approvedAt !== undefined ? { approvedAt } : {}),
        ...(input.notes !== undefined ? { notes: cleanNullable(input.notes) } : {}),
      },
    });
    if (before.formType === ConsignmentFormType.BLUE && (signedAt || approvedAt || formStatus === ConsignmentFormStatus.SIGNED || formStatus === ConsignmentFormStatus.APPROVED)) {
      const baselineAt = approvedAt ?? signedAt ?? new Date();
      await tx.consignmentSite.update({
        where: { id: before.siteId },
        data: {
          baselineEstablishedAt: baselineAt,
          status: ConsignmentSiteStatus.BASELINE_PENDING,
          nextAuditDueAt: addDays(baselineAt, ROSE_CADENCE_DAYS),
        },
      });
    }
    await tx.auditEntry.create({ data: buildAuditEntryData({ actorUserId: actor.userId, action: AuditAction.UPDATE, entityType: 'CONSIGNMENT_FORM', entityId: row.id, beforeData: before, afterData: row }) });
    return row;
  });
  return mapForm(updated);
}

export async function createConsignmentAdjustment(actor: AuthenticatedActor, siteId: string, input: CreateConsignmentAdjustmentRequest): Promise<ConsignmentSiteDetail> {
  assertConsignmentDocumentManage(actor);
  const site = await getSiteForMutation(actor, siteId);
  const currentTotal = normalizeNonNegativeInteger(input.currentTotal, 'currentTotal');
  const addQuantity = normalizeNonNegativeInteger(input.addQuantity ?? 0, 'addQuantity');
  const removeQuantity = normalizeNonNegativeInteger(input.removeQuantity ?? 0, 'removeQuantity');
  if (addQuantity === 0 && removeQuantity === 0 && input.proposedTotal === undefined) {
    throw new Error('PURPLE adjustment must change the manual baseline total');
  }
  if (removeQuantity > currentTotal) {
    throw new Error('removeQuantity cannot exceed currentTotal');
  }
  const proposedTotal = input.proposedTotal !== undefined
    ? normalizeNonNegativeInteger(input.proposedTotal, 'proposedTotal')
    : currentTotal + addQuantity - removeQuantity;
  if (proposedTotal === currentTotal) {
    throw new Error('PURPLE adjustment proposedTotal must differ from currentTotal');
  }

  await prisma.$transaction(async (tx) => {
    const documentId = input.documentId ?? (await tx.consignmentForm.create({
      data: compact({
        siteId,
        formType: ConsignmentFormType.PURPLE,
        status: ConsignmentFormStatus.CURRENT,
        title: 'PURPLE - Inventory Adjustment',
        receivedAt: new Date(),
        notes: cleanOptional(input.notes),
        createdByUserId: actor.userId,
      }) as any,
    })).id;
    const adjustment = await tx.consignmentAdjustment.create({
      data: compact({
        siteId,
        documentId,
        status: ConsignmentAdjustmentStatus.REQUESTED,
        reasonCode: cleanOptional(input.reasonCode),
        currentTotal,
        addQuantity,
        removeQuantity,
        proposedTotal,
        notes: cleanOptional(input.notes),
        createdByUserId: actor.userId,
      }) as any,
    });
    await tx.consignmentWorkItem.create({
      data: {
        siteId,
        type: ConsignmentWorkItemType.ADJUSTMENT_REVIEW,
        status: ConsignmentWorkItemStatus.OPEN,
        priority: 'normal',
        title: 'Review PURPLE baseline adjustment',
        notes: 'Manual baseline review only. Acumatica inventory adjustment posting remains parked.',
      },
    });
    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: 'CONSIGNMENT_ADJUSTMENT',
        entityId: adjustment.id,
        afterData: { siteId, currentTotal, addQuantity, removeQuantity, proposedTotal },
        metadata: { acumaticaInventoryAdjustment: 'parked' },
      }),
    });
  });

  return (await getConsignmentSiteDetail(actor, site.id))!;
}

export async function applyConsignmentAdjustment(actor: AuthenticatedActor, adjustmentId: string, input: ApplyConsignmentAdjustmentRequest): Promise<ConsignmentSiteDetail> {
  assertConsignmentManage(actor);
  const adjustment = await prisma.consignmentAdjustment.findUnique({ where: { id: adjustmentId }, include: { site: { include: SITE_INCLUDE } } });
  if (!adjustment) throw new Error('Consignment adjustment not found');
  await getSiteForMutation(actor, adjustment.siteId);
  if (adjustment.status !== ConsignmentAdjustmentStatus.REQUESTED) {
    throw new Error('Only requested PURPLE adjustments can be applied');
  }
  if (adjustment.site.manualBaselineQuantity !== null && adjustment.site.manualBaselineQuantity !== adjustment.currentTotal) {
    throw new Error('PURPLE adjustment currentTotal no longer matches the site manual baseline');
  }
  const appliedAt = input.appliedAt ? parseRequiredDate(input.appliedAt, 'appliedAt') : new Date();

  await prisma.$transaction(async (tx) => {
    const row = await tx.consignmentAdjustment.update({
      where: { id: adjustment.id },
      data: {
        status: ConsignmentAdjustmentStatus.APPLIED,
        appliedAt,
        notes: appendNotes(adjustment.notes, buildAdjustmentNotes(input.notes)),
      },
    });
    await tx.consignmentSite.update({
      where: { id: adjustment.siteId },
      data: {
        manualBaselineQuantity: adjustment.proposedTotal,
        baselineEstablishedAt: appliedAt,
      },
    });
    await tx.consignmentWorkItem.updateMany({
      where: {
        siteId: adjustment.siteId,
        type: ConsignmentWorkItemType.ADJUSTMENT_REVIEW,
        status: { in: [ConsignmentWorkItemStatus.OPEN, ConsignmentWorkItemStatus.IN_PROGRESS, ConsignmentWorkItemStatus.BLOCKED] },
      },
      data: { status: ConsignmentWorkItemStatus.COMPLETED, completedAt: appliedAt },
    });
    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: 'CONSIGNMENT_ADJUSTMENT',
        entityId: row.id,
        beforeData: adjustment,
        afterData: row,
        metadata: { acumaticaInventoryAdjustment: 'parked', pulseManualBaselineUpdated: true },
      }),
    });
  });

  return (await getConsignmentSiteDetail(actor, adjustment.siteId))!;
}

export async function startConsignmentExit(actor: AuthenticatedActor, siteId: string, input: StartConsignmentExitRequest): Promise<ConsignmentSiteDetail> {
  assertConsignmentManage(actor);
  const site = await getSiteForMutation(actor, siteId);
  if (site.status === ConsignmentSiteStatus.EXITED) throw new Error('Exited consignment sites cannot start another SAND exit');
  const noticeGivenAt = input.noticeGivenAt ? parseRequiredDate(input.noticeGivenAt, 'noticeGivenAt') : new Date();
  const plannedExitAt = input.plannedExitAt ? parseRequiredDate(input.plannedExitAt, 'plannedExitAt') : undefined;

  await prisma.$transaction(async (tx) => {
    const documentId = input.documentId ?? (await tx.consignmentForm.create({
      data: compact({
        siteId,
        formType: ConsignmentFormType.SAND,
        status: ConsignmentFormStatus.SENT,
        title: 'SAND - Program Exit',
        receivedAt: noticeGivenAt,
        notes: cleanOptional(input.notes),
        createdByUserId: actor.userId,
      }) as any,
    })).id;
    const existingOpenExit = await tx.consignmentExit.findFirst({ where: { siteId, status: { in: [ConsignmentExitStatus.NOTICE_GIVEN, ConsignmentExitStatus.FINAL_RECONCILIATION] } } });
    if (!existingOpenExit) {
      await tx.consignmentExit.create({
        data: compact({
          siteId,
          documentId,
          status: ConsignmentExitStatus.NOTICE_GIVEN,
          noticeGivenAt,
          plannedExitAt,
          notes: cleanOptional(input.notes),
          createdByUserId: actor.userId,
        }) as any,
      });
    }
    await tx.consignmentSite.update({ where: { id: siteId }, data: { status: ConsignmentSiteStatus.EXITING } });
    const existingExitReview = await tx.consignmentWorkItem.findFirst({
      where: {
        siteId,
        type: ConsignmentWorkItemType.EXIT_REVIEW,
        status: { in: [ConsignmentWorkItemStatus.OPEN, ConsignmentWorkItemStatus.IN_PROGRESS, ConsignmentWorkItemStatus.BLOCKED] },
      },
    });
    if (!existingExitReview) {
      await tx.consignmentWorkItem.create({
        data: compact({
          siteId,
          type: ConsignmentWorkItemType.EXIT_REVIEW,
          status: ConsignmentWorkItemStatus.OPEN,
          priority: 'high',
          title: 'Complete SAND exit reconciliation',
          dueAt: plannedExitAt,
          notes: 'Record final reconciliation, return/retain quantities, and settlement reference. Finance/Acumatica posting remains parked.',
        }) as any,
      });
    }
    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: 'CONSIGNMENT_EXIT',
        entityId: documentId,
        afterData: { siteId, noticeGivenAt, plannedExitAt },
        metadata: { acumaticaSettlementPosting: 'parked' },
      }),
    });
  });

  return (await getConsignmentSiteDetail(actor, site.id))!;
}

export async function closeConsignmentExit(actor: AuthenticatedActor, exitId: string, input: CloseConsignmentExitRequest): Promise<ConsignmentSiteDetail> {
  assertConsignmentManage(actor);
  const exit = await prisma.consignmentExit.findUnique({ where: { id: exitId }, include: { site: { include: SITE_INCLUDE } } });
  if (!exit) throw new Error('Consignment exit not found');
  await getSiteForMutation(actor, exit.siteId);
  if (exit.status === ConsignmentExitStatus.CLOSED) {
    return (await getConsignmentSiteDetail(actor, exit.siteId))!;
  }
  const finalReconciliationAt = input.finalReconciliationAt ? parseRequiredDate(input.finalReconciliationAt, 'finalReconciliationAt') : new Date();
  const returnQuantity = normalizeNonNegativeInteger(input.returnQuantity ?? 0, 'returnQuantity');
  const retainedQuantity = normalizeNonNegativeInteger(input.retainedQuantity ?? 0, 'retainedQuantity');
  if (returnQuantity === 0 && retainedQuantity === 0 && !cleanOptional(input.settlementReference)) {
    throw new Error('SAND closure needs return quantity, retained quantity, or settlement reference');
  }

  await prisma.$transaction(async (tx) => {
    const row = await tx.consignmentExit.update({
      where: { id: exit.id },
      data: compact({
        status: ConsignmentExitStatus.CLOSED,
        finalReconciliationAt,
        returnQuantity,
        retainedQuantity,
        settlementReference: cleanOptional(input.settlementReference),
        closedAt: finalReconciliationAt,
        notes: appendNotes(exit.notes, buildExitClosureNotes(input.notes)),
      }) as any,
    });
    await tx.consignmentSite.update({
      where: { id: exit.siteId },
      data: {
        status: ConsignmentSiteStatus.EXITED,
        exitedAt: finalReconciliationAt,
      },
    });
    await tx.consignmentWorkItem.updateMany({
      where: {
        siteId: exit.siteId,
        type: { in: [ConsignmentWorkItemType.EXIT_REVIEW, ConsignmentWorkItemType.PO_FOLLOW_UP, ConsignmentWorkItemType.VARIANCE_REVIEW] },
        status: { in: [ConsignmentWorkItemStatus.OPEN, ConsignmentWorkItemStatus.IN_PROGRESS, ConsignmentWorkItemStatus.BLOCKED] },
      },
      data: { status: ConsignmentWorkItemStatus.COMPLETED, completedAt: finalReconciliationAt },
    });
    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: 'CONSIGNMENT_EXIT',
        entityId: row.id,
        beforeData: exit,
        afterData: row,
        metadata: { acumaticaSettlementPosting: 'parked', siteExited: true },
      }),
    });
  });

  return (await getConsignmentSiteDetail(actor, exit.siteId))!;
}

export async function markConsignmentPoReceived(actor: AuthenticatedActor, discrepancyId: string, input: MarkConsignmentPoReceivedRequest): Promise<ConsignmentSiteDetail> {
  assertConsignmentManage(actor);
  const discrepancy = await prisma.consignmentDiscrepancyCase.findUnique({ where: { id: discrepancyId } });
  if (!discrepancy) throw new Error('Consignment discrepancy not found');
  await getSiteForMutation(actor, discrepancy.siteId);
  if (discrepancy.poFollowUpStatus !== ConsignmentPoFollowUpStatus.REQUIRED && discrepancy.status !== ConsignmentDiscrepancyStatus.PO_REQUIRED) {
    throw new Error('Only PO-required discrepancies can be marked received');
  }
  const receivedAt = input.receivedAt ? parseRequiredDate(input.receivedAt, 'receivedAt') : new Date();

  await prisma.$transaction(async (tx) => {
    const row = await tx.consignmentDiscrepancyCase.update({
      where: { id: discrepancy.id },
      data: {
        status: ConsignmentDiscrepancyStatus.PO_RECEIVED,
        poFollowUpStatus: ConsignmentPoFollowUpStatus.RECEIVED,
        externalPoRef: cleanOptional(input.externalPoRef) ?? discrepancy.externalPoRef,
        notes: appendNotes(discrepancy.notes, buildPoReceivedNotes(input.notes, receivedAt)),
      },
    });
    await tx.consignmentWorkItem.updateMany({
      where: {
        siteId: discrepancy.siteId,
        type: ConsignmentWorkItemType.PO_FOLLOW_UP,
        status: { in: [ConsignmentWorkItemStatus.OPEN, ConsignmentWorkItemStatus.IN_PROGRESS, ConsignmentWorkItemStatus.BLOCKED] },
      },
      data: { status: ConsignmentWorkItemStatus.COMPLETED, completedAt: receivedAt },
    });
    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: 'CONSIGNMENT_DISCREPANCY',
        entityId: row.id,
        beforeData: discrepancy,
        afterData: row,
        metadata: { acumaticaPoPosting: 'manual_reference_only' },
      }),
    });

    // FR-CSG-031 / FR-CSG-033: when this PO closes the LAST PO-required
    // discrepancy for the audit, the audit cycle is fully resolved.
    // Recalculate the site baseline and schedule the next ROSE +90 days.
    // Skip when:
    //   - the discrepancy is not linked to an audit (manual/PURPLE flows);
    //   - there are other still-open PO_REQUIRED discrepancies for the audit;
    //   - or the site has already moved past active (e.g. exited).
    if (discrepancy.auditId) {
      const remainingPoRequired = await tx.consignmentDiscrepancyCase.count({
        where: {
          auditId: discrepancy.auditId,
          id: { not: discrepancy.id },
          OR: [
            { status: ConsignmentDiscrepancyStatus.PO_REQUIRED },
            { poFollowUpStatus: ConsignmentPoFollowUpStatus.REQUIRED },
            { poFollowUpStatus: ConsignmentPoFollowUpStatus.ESCALATED },
          ],
        },
      });

      if (remainingPoRequired === 0) {
        await tx.consignmentAudit.update({
          where: { id: discrepancy.auditId },
          data: { reconciliationStatus: ConsignmentReconciliationStatus.RESOLVED },
        });
        const site = await tx.consignmentSite.findUnique({
          where: { id: discrepancy.siteId },
          select: {
            id: true,
            status: true,
            baselineEstablishedAt: true,
            nextAuditDueAt: true,
          },
        });
        if (site && site.status !== ConsignmentSiteStatus.EXITED) {
          const updatedSite = await tx.consignmentSite.update({
            where: { id: site.id },
            data: {
              baselineEstablishedAt: receivedAt,
              nextAuditDueAt: calculateNextRoseAuditDueDate(receivedAt),
            },
          });
          await tx.auditEntry.create({
            data: buildAuditEntryData({
              actorUserId: actor.userId,
              action: AuditAction.UPDATE,
              entityType: 'CONSIGNMENT_SITE',
              entityId: site.id,
              beforeData: {
                baselineEstablishedAt: site.baselineEstablishedAt,
                nextAuditDueAt: site.nextAuditDueAt,
              },
              afterData: {
                baselineEstablishedAt: updatedSite.baselineEstablishedAt,
                nextAuditDueAt: updatedSite.nextAuditDueAt,
              },
              metadata: {
                trigger: 'po_received_baseline_recalc',
                auditId: discrepancy.auditId,
                discrepancyId: discrepancy.id,
              },
            }),
          });
        }
      }
    }
  });

  return (await getConsignmentSiteDetail(actor, discrepancy.siteId))!;
}

export async function listConsignmentAudits(actor: AuthenticatedActor, siteId: string): Promise<ConsignmentAuditSummary[] | null> {
  const site = await getConsignmentSiteDetail(actor, siteId);
  return site?.audits ?? null;
}

export async function createConsignmentAudit(actor: AuthenticatedActor, siteId: string, input: CreateConsignmentAuditRequest): Promise<ConsignmentAuditSummary> {
  assertConsignmentAuditManage(actor);
  await getSiteForMutation(actor, siteId);
  const scheduledFor = parseRequiredDate(input.scheduledFor, 'scheduledFor');
  const audit = await prisma.$transaction(async (tx) => {
    const created = await tx.consignmentAudit.create({
      data: compact({ siteId, scheduledFor, notes: cleanOptional(input.notes) }) as any,
      include: { lines: true, evidence: true },
    });
    await tx.consignmentSite.update({
      where: { id: siteId },
      data: { nextAuditDueAt: scheduledFor },
    });
    return created;
  });
  return mapAudit(audit);
}

export async function updateConsignmentAudit(actor: AuthenticatedActor, auditId: string, input: UpdateConsignmentAuditRequest): Promise<ConsignmentAuditSummary> {
  assertConsignmentAuditManage(actor);
  const audit = await prisma.consignmentAudit.findUnique({ where: { id: auditId }, select: { id: true, siteId: true } });
  if (!audit) throw new Error('Consignment audit not found');
  if (input.completedAt !== undefined || input.lines !== undefined || input.status === 'completed') {
    return completeAudit(actor, audit.siteId, audit.id, compact({ completedAt: input.completedAt ?? undefined, notes: input.notes, reconciliationStatus: input.reconciliationStatus, lines: input.lines }) as UpdateConsignmentAuditRequest);
  }
  await getSiteForMutation(actor, audit.siteId);
  const updated = await prisma.consignmentAudit.update({ where: { id: audit.id }, data: { ...(input.scheduledFor !== undefined ? { scheduledFor: parseRequiredDate(input.scheduledFor, 'scheduledFor') } : {}), ...(input.status !== undefined ? { status: input.status.toUpperCase() as ConsignmentAuditStatus } : {}), ...(input.notes !== undefined ? { notes: cleanNullable(input.notes) } : {}), ...(input.reconciliationStatus !== undefined ? { reconciliationStatus: toReconciliationStatus(input.reconciliationStatus) } : {}) }, include: { lines: { orderBy: [{ createdAt: 'asc' }] }, evidence: { orderBy: [{ uploadedAt: 'desc' }] } } });
  return mapAudit(updated);
}

export async function uploadConsignmentAuditEvidence(
  actor: AuthenticatedActor,
  config: AppConfig,
  auditId: string,
  input: UploadConsignmentAuditEvidenceRequest,
): Promise<UploadConsignmentAuditEvidenceResponse> {
  assertConsignmentAuditManage(actor);
  const audit = await prisma.consignmentAudit.findFirst({
    where: { AND: [{ id: auditId }, { site: siteScopeWhere(actor) }] },
    include: { lines: { orderBy: [{ createdAt: 'asc' }] }, evidence: { orderBy: [{ uploadedAt: 'desc' }] } },
  });
  if (!audit) throw new Error('Consignment audit not found');
  if (audit.status === ConsignmentAuditStatus.CANCELLED) throw new Error('Evidence cannot be uploaded to a cancelled ROSE audit');

  const fileName = cleanOptional(input.fileName);
  const mimeType = cleanOptional(input.mimeType)?.toLowerCase();
  const contentBase64 = cleanOptional(input.contentBase64);
  if (!fileName) throw new Error('fileName is required');
  if (!mimeType) throw new Error('mimeType is required');
  if (!contentBase64) throw new Error('contentBase64 is required');
  if (!CONSIGNMENT_EVIDENCE_ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('ROSE evidence upload accepts photos only');
  }
  const estimatedSizeBytes = estimateBase64DecodedSize(contentBase64);
  if (estimatedSizeBytes > CONSIGNMENT_EVIDENCE_MAX_BYTES) {
    throw new Error('ROSE evidence photo cannot exceed 4 MB');
  }

  const purpose = toEvidencePurpose(input.purpose ?? 'general');
  const storageKey = buildConsignmentEvidenceStorageKey(auditId, fileName);
  const stored = await storeBase64Document(config, { storageKey, contentBase64 });

  const result = await prisma.$transaction(async (tx) => {
    const evidence = await tx.consignmentAuditEvidence.create({
      data: {
        auditId,
        siteId: audit.siteId,
        purpose,
        storageKey,
        fileName,
        mimeType,
        sizeBytes: stored.sizeBytes,
        sha256: stored.sha256,
        uploadedByUserId: actor.userId,
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      },
      include: { uploadedBy: { select: { id: true, displayName: true } } },
    });

    const nextAudit = await tx.consignmentAudit.findUniqueOrThrow({
      where: { id: auditId },
      include: { lines: { orderBy: [{ createdAt: 'asc' }] }, evidence: { orderBy: [{ uploadedAt: 'desc' }] } },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: 'CONSIGNMENT_AUDIT_EVIDENCE',
        entityId: evidence.id,
        afterData: { ...mapEvidence(evidence) },
        metadata: {
          auditId,
          siteId: audit.siteId,
          acumaticaBoundary: 'not_an_acumatica_attachment',
          storageOwner: 'pulse_crm',
        },
      }),
    });

    return { evidence, audit: nextAudit };
  });

  return {
    audit: mapAudit(result.audit),
    evidence: mapEvidence(result.evidence),
  };
}

export async function listConsignmentReadinessItems(actor: AuthenticatedActor, siteId: string): Promise<ConsignmentReadinessItemSummary[] | null> {
  const site = await getConsignmentSiteDetail(actor, siteId);
  if (!site) return null;
  const hasAgreement = site.forms.some((form) => form.formType === 'agreement' && ['signed', 'approved'].includes(form.status));
  const hasBlue = site.forms.some((form) => form.formType === 'blue' && ['signed', 'approved', 'current'].includes(form.status));
  return [
    { code: 'agreement_signed', label: 'Agreement signed', status: hasAgreement ? 'complete' : 'pending', blocking: !hasAgreement },
    { code: 'warehouse_boundary', label: 'Setup handoff', status: site.warehouseCode ? 'complete' : 'blocked', blocking: !site.warehouseCode, detail: site.warehouseCode ? 'Setup reference is present.' : 'Warehouse creation remains parked until sandbox access and certified mappings are available.' },
    { code: 'blue_baseline', label: 'BLUE baseline captured', status: hasBlue || site.baselineEstablishedAt ? 'complete' : 'pending', blocking: !(hasBlue || site.baselineEstablishedAt) },
  ];
}

export function buildConsignmentSiteScopeWhere(actor: AuthenticatedActor): Prisma.ConsignmentSiteWhereInput {
  return siteScopeWhere(actor);
}

export function calculateNextRoseAuditDueDate(from: Date) {
  return addDays(from, ROSE_CADENCE_DAYS);
}

export function calculatePoFollowUpDueDate(from: Date) {
  return addBusinessDays(from, PO_CLOCK_BUSINESS_DAYS);
}

export async function confirmConsignmentTrueUp(actor: AuthenticatedActor, auditId: string, input: ConfirmConsignmentTrueUpRequest): Promise<ConfirmConsignmentTrueUpResponse> {
  assertConsignmentManage(actor);
  const audit = await prisma.consignmentAudit.findFirst({
    where: { AND: [{ id: auditId }, { site: siteScopeWhere(actor) }] },
    include: { lines: { orderBy: [{ createdAt: 'asc' }] }, evidence: { orderBy: [{ uploadedAt: 'desc' }] } },
  });
  if (!audit) throw new Error('Consignment audit not found');
  if (audit.status !== ConsignmentAuditStatus.COMPLETED) {
    throw new Error('ROSE audit must be completed before true-up can be confirmed');
  }
  const hasVariance = audit.lines.some((line) => computeVariance(line.expectedQuantity ?? undefined, line.actualQuantity ?? undefined) !== 0);
  if (!hasVariance) {
    throw new Error('True-up confirmation requires a completed audit variance');
  }
  const confirmedAt = parseOptionalDate(input.confirmedAt) ?? new Date();
  const outcome = toTrueUpOutcome(input.outcome);
  const reasonCode = cleanOptional(input.reasonCode);
  const notes = buildTrueUpNotes(input.notes, outcome);
  const externalPoRef = cleanOptional(input.externalPoRef);

  const updatedAudit = await prisma.$transaction(async (tx) => {
    let discrepancy = await tx.consignmentDiscrepancyCase.findFirst({ where: { auditId } });
    if (!discrepancy) {
      discrepancy = await tx.consignmentDiscrepancyCase.create({
        data: {
          siteId: audit.siteId,
          auditId,
          status: ConsignmentDiscrepancyStatus.IN_REVIEW,
          poFollowUpStatus: ConsignmentPoFollowUpStatus.NOT_REQUIRED,
          notes: 'Created from ROSE audit variance. True-up review required before PO clock starts.',
        },
      });
    }

    const poDueAt = outcome === 'po_required' ? addBusinessDays(confirmedAt, PO_CLOCK_BUSINESS_DAYS) : null;
    await tx.consignmentDiscrepancyCase.update({
      where: { id: discrepancy.id },
      data: compact({
        status: outcome === 'po_required'
          ? ConsignmentDiscrepancyStatus.PO_REQUIRED
          : outcome === 'write_off'
            ? ConsignmentDiscrepancyStatus.WRITTEN_OFF
            : ConsignmentDiscrepancyStatus.RESOLVED,
        poFollowUpStatus: outcome === 'po_required'
          ? ConsignmentPoFollowUpStatus.REQUIRED
          : outcome === 'write_off'
            ? ConsignmentPoFollowUpStatus.WAIVED
            : ConsignmentPoFollowUpStatus.NOT_REQUIRED,
        reasonCode,
        trueUpConfirmedAt: confirmedAt,
        poDueAt,
        externalPoRef,
        notes: appendNotes(discrepancy.notes, notes),
      }) as any,
    });

    await tx.consignmentWorkItem.updateMany({
      where: {
        siteId: audit.siteId,
        type: ConsignmentWorkItemType.VARIANCE_REVIEW,
        status: { in: [ConsignmentWorkItemStatus.OPEN, ConsignmentWorkItemStatus.IN_PROGRESS, ConsignmentWorkItemStatus.BLOCKED] },
      },
      data: { status: ConsignmentWorkItemStatus.COMPLETED, completedAt: confirmedAt },
    });

    if (outcome === 'po_required') {
      const existingPoFollowUp = await tx.consignmentWorkItem.findFirst({
        where: {
          siteId: audit.siteId,
          type: ConsignmentWorkItemType.PO_FOLLOW_UP,
          status: { in: [ConsignmentWorkItemStatus.OPEN, ConsignmentWorkItemStatus.IN_PROGRESS, ConsignmentWorkItemStatus.BLOCKED] },
        },
      });
      if (!existingPoFollowUp) {
        await tx.consignmentWorkItem.create({
          data: {
            siteId: audit.siteId,
            type: ConsignmentWorkItemType.PO_FOLLOW_UP,
            status: ConsignmentWorkItemStatus.OPEN,
            priority: 'high',
            title: 'Follow up on confirmed consignment PO within 5 business days',
            dueAt: poDueAt,
            notes: 'True-up confirmed a real customer PO follow-up. Track manually in Pulse; Acumatica PO/order posting remains parked.',
          },
        });
      }
    }

    const nextAudit = await tx.consignmentAudit.update({
      where: { id: auditId },
      data: {
        reconciliationStatus: outcome === 'po_required'
          ? ConsignmentReconciliationStatus.TRUE_UP_CONFIRMED
          : ConsignmentReconciliationStatus.RESOLVED,
      },
      include: { lines: { orderBy: [{ createdAt: 'asc' }] }, evidence: { orderBy: [{ uploadedAt: 'desc' }] } },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: 'CONSIGNMENT_TRUE_UP',
        entityId: auditId,
        beforeData: { reconciliationStatus: audit.reconciliationStatus },
        afterData: {
          reconciliationStatus: nextAudit.reconciliationStatus,
          outcome,
          reasonCode,
          poDueAt,
          externalPoRef,
        },
        metadata: {
          acumaticaPoCreation: 'parked',
          poClockStarted: outcome === 'po_required',
          trueUpConfirmedAt: confirmedAt.toISOString(),
        },
      }),
    });

    return nextAudit;
  });

  const site = await getConsignmentSiteDetail(actor, audit.siteId);
  if (!site) throw new Error('Consignment site not found after true-up confirmation');
  return { audit: mapAudit(updatedAudit), site };
}

async function completeAudit(actor: AuthenticatedActor, siteId: string, auditId: string, input: CompleteConsignmentAuditRequest): Promise<ConsignmentAuditSummary> {
  await getSiteForMutation(actor, siteId);
  const completedAt = parseOptionalDate(input.completedAt) ?? new Date();
  const lines = input.lines ?? [];
  const hasVariance = lines.some((line: NonNullable<UpdateConsignmentAuditRequest['lines']>[number]) => computeVariance(line.expectedQuantity, line.actualQuantity) !== 0);
  const reconciliationStatus = input.reconciliationStatus ? toReconciliationStatus(input.reconciliationStatus) : (hasVariance ? ConsignmentReconciliationStatus.OPEN : ConsignmentReconciliationStatus.RESOLVED);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.consignmentAuditLine.deleteMany({ where: { auditId } });
    await tx.consignmentAudit.update({ where: { id: auditId, siteId }, data: compact({ status: ConsignmentAuditStatus.COMPLETED, completedAt, reconciliationStatus, notes: cleanOptional(input.notes), submittedByUserId: actor.userId }) as any });
    if (lines.length > 0) {
      await tx.consignmentAuditLine.createMany({
        data: lines.map((line: NonNullable<UpdateConsignmentAuditRequest['lines']>[number]) => compact({
          auditId,
          sku: cleanOptional(line.sku),
          barcode: cleanOptional(line.barcode),
          productName: line.productName,
          expectedQuantity: line.expectedQuantity,
          actualQuantity: line.actualQuantity,
          varianceQuantity: computeVariance(line.expectedQuantity, line.actualQuantity),
          notes: cleanOptional(line.notes),
        }) as any),
      });
    }
    const row = await tx.consignmentAudit.findUniqueOrThrow({ where: { id: auditId }, include: { lines: { orderBy: [{ createdAt: 'asc' }] }, evidence: { orderBy: [{ uploadedAt: 'desc' }] } } });
    await tx.consignmentSite.update({ where: { id: siteId }, data: { lastAuditCompletedAt: completedAt, nextAuditDueAt: addDays(completedAt, ROSE_CADENCE_DAYS) } });
    if (hasVariance) {
      const existingDiscrepancy = await tx.consignmentDiscrepancyCase.findFirst({ where: { auditId } });
      if (!existingDiscrepancy) {
        await tx.consignmentDiscrepancyCase.create({ data: { siteId, auditId, status: ConsignmentDiscrepancyStatus.IN_REVIEW, poFollowUpStatus: ConsignmentPoFollowUpStatus.NOT_REQUIRED, notes: 'Created from ROSE audit variance. True-up review required before PO clock starts.' } });
      }
      const existingVarianceReview = await tx.consignmentWorkItem.findFirst({
        where: {
          siteId,
          type: ConsignmentWorkItemType.VARIANCE_REVIEW,
          status: { in: [ConsignmentWorkItemStatus.OPEN, ConsignmentWorkItemStatus.IN_PROGRESS, ConsignmentWorkItemStatus.BLOCKED] },
          title: 'Review ROSE variance before PO follow-up',
        },
      });
      if (!existingVarianceReview && !existingDiscrepancy?.trueUpConfirmedAt) {
        await tx.consignmentWorkItem.create({ data: { siteId, type: ConsignmentWorkItemType.VARIANCE_REVIEW, status: ConsignmentWorkItemStatus.OPEN, priority: 'high', title: 'Review ROSE variance before PO follow-up', dueAt: completedAt, notes: 'Check open POs, in-transit items, transfer/receipt status, and known replenishment before starting the PO clock.' } });
      }
    }
    await tx.auditEntry.create({ data: buildAuditEntryData({ actorUserId: actor.userId, action: AuditAction.UPDATE, entityType: 'CONSIGNMENT_AUDIT', entityId: row.id, afterData: row, metadata: { generatedDiscrepancy: hasVariance, trueUpRequired: hasVariance, acumaticaPoCreation: 'parked' } }) });
    return row;
  });
  return mapAudit(updated);
}

function buildSiteWhere(actor: AuthenticatedActor, input: ListConsignmentSitesRequest): Prisma.ConsignmentSiteWhereInput {
  const filters: Prisma.ConsignmentSiteWhereInput[] = [siteScopeWhere(actor)];
  if (!input.includeExited && !input.includeClosed) filters.push({ status: { not: ConsignmentSiteStatus.EXITED } });
  if (input.status ?? input.readinessState) filters.push({ status: toSiteStatus((input.status ?? input.readinessState) as ConsignmentSiteStatusKey) });
  if (input.assignedTmUserId) filters.push({ ownerTmUserId: input.assignedTmUserId });
  if (input.assignedRdUserId) filters.push({ ownerRdUserId: input.assignedRdUserId });
  if (input.dueWithinDays !== undefined) filters.push({ nextAuditDueAt: { lte: addDays(new Date(), input.dueWithinDays) } });
  if (input.search) filters.push({ OR: [{ name: { contains: input.search, mode: 'insensitive' } }, { warehouseCode: { contains: input.search, mode: 'insensitive' } }, { account: { displayName: { contains: input.search, mode: 'insensitive' } } }] });
  return { AND: filters };
}

function buildOperationalQueueWhere(actor: AuthenticatedActor, input: ConsignmentOperationalQueueRequest): Prisma.ConsignmentSiteWhereInput {
  const filters: Prisma.ConsignmentSiteWhereInput[] = [siteScopeWhere(actor)];
  const status = input.status ?? input.readinessState;
  if (status) filters.push({ status: toSiteStatus(status) });
  if (input.auditStatus) filters.push({ audits: { some: { status: input.auditStatus.toUpperCase() as ConsignmentAuditStatus } } });
  return { AND: filters };
}

function siteScopeWhere(actor: AuthenticatedActor): Prisma.ConsignmentSiteWhereInput {
  if (actor.role === 'TERRITORY_MANAGER') return { ownerTmUserId: actor.userId };
  if (actor.role === 'REGIONAL_DIRECTOR') return { OR: [{ ownerRdUserId: actor.userId }, { region: { directorUserId: actor.userId } }] };
  return {};
}

function isScopedConsignmentRole(actor: AuthenticatedActor) {
  return actor.role === 'TERRITORY_MANAGER' || actor.role === 'REGIONAL_DIRECTOR';
}

async function getSiteForMutation(actor: AuthenticatedActor, siteId: string): Promise<SiteWithRelations> {
  const site = await prisma.consignmentSite.findFirst({ where: { AND: [{ id: siteId }, siteScopeWhere(actor)] }, include: SITE_INCLUDE });
  if (!site) throw new Error('Consignment site not found');
  return site;
}

function assertConsignmentAccess(actor: AuthenticatedActor) {
  assertModuleAccess(actor.role, 'consignment');
  assertActionAccess(actor.role, 'consignment.view');
  if (actor.role === 'DEALER_PORTAL_USER') throwAuthorization('Consignment is internal-only in the current phase');
}

function assertConsignmentManage(actor: AuthenticatedActor) {
  assertConsignmentAccess(actor);
  assertActionAccess(actor.role, 'consignment.manage');
  if (actor.role === 'EXECUTIVE') throwAuthorization('Executive role can view consignment but cannot manage workflow records');
}

function assertConsignmentDocumentManage(actor: AuthenticatedActor) {
  assertModuleAccess(actor.role, 'consignment');
  assertActionAccess(actor.role, 'consignment.document_manage');
}

function assertConsignmentAuditManage(actor: AuthenticatedActor) {
  assertModuleAccess(actor.role, 'consignment');
  assertActionAccess(actor.role, 'consignment.audit');
}

function assertSiteCanActivate(site: SiteWithRelations, input: UpdateConsignmentSiteRequest) {
  const warehouseCode = input.warehouseCode !== undefined ? cleanNullable(input.warehouseCode) : site.warehouseCode;
  const hasAgreement = site.forms.some((form) => form.formType === ConsignmentFormType.AGREEMENT && ACTIVATION_READY_FORM_STATUSES.has(form.status));
  const hasBlueBaseline = Boolean(site.baselineEstablishedAt) || site.forms.some((form) => form.formType === ConsignmentFormType.BLUE && ACTIVATION_READY_FORM_STATUSES.has(form.status));
  const blockers = [
    ...(hasAgreement ? [] : ['signed agreement']),
    ...(hasBlueBaseline ? [] : ['BLUE baseline evidence']),
    ...(warehouseCode ? [] : ['warehouse reference']),
  ];
  if (blockers.length > 0) {
    throw new Error(`Consignment site cannot become active until ${blockers.join(', ')} exist`);
  }
}

function throwAuthorization(message: string): never {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  throw error;
}

function mapSiteDetail(site: SiteWithRelations): ConsignmentSiteDetail {
  return {
    ...mapSiteSummary(site),
    forms: site.forms.map(mapForm),
    audits: site.audits.map(mapAudit),
    workItems: site.workItems.map(mapWorkItem),
    discrepancyCases: site.discrepancyCases.map(mapDiscrepancyCase),
    adjustments: site.adjustments.map(mapAdjustment),
    exits: site.exits.map(mapExit),
    fieldActivity: site.mobileVoiceNotes.map(mapFieldActivityNote),
  };
}

function mapWorkItem(item: SiteWithRelations['workItems'][number]): ConsignmentSiteDetail['workItems'][number] {
  return { id: item.id, siteId: item.siteId, type: item.type.toLowerCase(), status: item.status.toLowerCase(), priority: item.priority, title: item.title, ...(item.assignedToUserId ? { assignedToUserId: item.assignedToUserId } : {}), ...(item.dueAt ? { dueAt: item.dueAt.toISOString() } : {}), ...(item.completedAt ? { completedAt: item.completedAt.toISOString() } : {}), ...(item.notes ? { notes: item.notes } : {}), createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
}

function mapDiscrepancyCase(item: SiteWithRelations['discrepancyCases'][number]): ConsignmentDiscrepancyCaseSummary {
  return { id: item.id, siteId: item.siteId, ...(item.auditId ? { auditId: item.auditId } : {}), status: item.status.toLowerCase(), poFollowUpStatus: item.poFollowUpStatus.toLowerCase(), ...(item.reasonCode ? { reasonCode: item.reasonCode } : {}), ...(item.sku ? { sku: item.sku } : {}), ...(item.productName ? { productName: item.productName } : {}), ...(item.quantity !== null ? { quantity: item.quantity } : {}), ...(item.trueUpConfirmedAt ? { trueUpConfirmedAt: item.trueUpConfirmedAt.toISOString() } : {}), ...(item.poDueAt ? { poDueAt: item.poDueAt.toISOString() } : {}), ...(item.externalPoRef ? { externalPoRef: item.externalPoRef } : {}), ...(item.notes ? { notes: item.notes } : {}), createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
}

function mapAdjustment(item: SiteWithRelations['adjustments'][number]): ConsignmentAdjustmentSummary {
  return { id: item.id, siteId: item.siteId, ...(item.documentId ? { documentId: item.documentId } : {}), status: item.status.toLowerCase() as ConsignmentAdjustmentSummary['status'], ...(item.reasonCode ? { reasonCode: item.reasonCode } : {}), currentTotal: item.currentTotal, addQuantity: item.addQuantity, removeQuantity: item.removeQuantity, proposedTotal: item.proposedTotal, ...(item.appliedAt ? { appliedAt: item.appliedAt.toISOString() } : {}), ...(item.rejectedAt ? { rejectedAt: item.rejectedAt.toISOString() } : {}), ...(item.notes ? { notes: item.notes } : {}), createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
}

function mapExit(item: SiteWithRelations['exits'][number]): ConsignmentExitSummary {
  return { id: item.id, siteId: item.siteId, ...(item.documentId ? { documentId: item.documentId } : {}), status: item.status.toLowerCase() as ConsignmentExitSummary['status'], noticeGivenAt: item.noticeGivenAt.toISOString(), ...(item.plannedExitAt ? { plannedExitAt: item.plannedExitAt.toISOString() } : {}), ...(item.finalReconciliationAt ? { finalReconciliationAt: item.finalReconciliationAt.toISOString() } : {}), ...(item.returnQuantity !== null ? { returnQuantity: item.returnQuantity } : {}), ...(item.retainedQuantity !== null ? { retainedQuantity: item.retainedQuantity } : {}), ...(item.settlementReference ? { settlementReference: item.settlementReference } : {}), ...(item.closedAt ? { closedAt: item.closedAt.toISOString() } : {}), ...(item.notes ? { notes: item.notes } : {}), createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
}

function mapFieldActivityNote(note: SiteWithRelations['mobileVoiceNotes'][number]): ConsignmentFieldActivityNoteSummary {
  return {
    id: note.id,
    title: note.title,
    ...(note.structuredSummary ? { summary: note.structuredSummary } : {}),
    ...(note.structuredNextStep ? { nextStep: note.structuredNextStep } : {}),
    ...(note.structuredSentiment ? { sentiment: note.structuredSentiment } : {}),
    ...(note.createdBy?.displayName ? { capturedByName: note.createdBy.displayName } : {}),
    ...(note.reviewedBy?.displayName ? { reviewedByName: note.reviewedBy.displayName } : {}),
    recordedAt: note.recordedAt.toISOString(),
    ...(note.reviewedAt ? { reviewedAt: note.reviewedAt.toISOString() } : {}),
    ...(note.writebackTarget ? { writebackTarget: note.writebackTarget } : {}),
  };
}

function mapSiteSummary(site: SiteWithRelations): ConsignmentSiteSummary {
  const formCounts = Object.fromEntries(['agreement', 'blue', 'rose', 'purple', 'sand', 'return', 'damage', 'master_reference'].map((type) => [type, 0])) as ConsignmentSiteSummary['formCounts'];
  for (const form of site.forms) formCounts[mapFormType(form.formType)] += 1;
  return { id: site.id, accountId: site.accountId, accountName: site.account.displayName, ...(site.locationId ? { locationId: site.locationId } : {}), ...(site.location?.name ? { locationName: site.location.name } : {}), ...(site.location?.city ? { locationCity: site.location.city } : {}), ...(site.location?.state ? { locationState: site.location.state } : {}), name: site.name, status: mapSiteStatus(site.status), acumaticaStatus: site.acumaticaStatus.toLowerCase() as ConsignmentSiteSummary['acumaticaStatus'], ...(site.warehouseCode ? { warehouseCode: site.warehouseCode } : {}), ...(site.acumaticaWarehouseId ? { acumaticaWarehouseId: site.acumaticaWarehouseId } : {}), ...(site.acumaticaLastSyncedAt ? { acumaticaLastSyncedAt: site.acumaticaLastSyncedAt.toISOString() } : {}), ...(site.acumaticaLastError ? { acumaticaLastError: site.acumaticaLastError } : {}), ...(site.ownerTmUserId ? { ownerTmUserId: site.ownerTmUserId } : {}), ...(site.ownerTmUser?.displayName ? { ownerTmName: site.ownerTmUser.displayName } : {}), ...(site.ownerRdUserId ? { ownerRdUserId: site.ownerRdUserId } : {}), ...(site.ownerRdUser?.displayName ? { ownerRdName: site.ownerRdUser.displayName } : {}), ...(site.territoryId ? { territoryId: site.territoryId } : {}), ...(site.territory?.name ? { territoryName: site.territory.name } : {}), ...(site.regionId ? { regionId: site.regionId } : {}), ...(site.region?.name ? { regionName: site.region.name } : {}), ...(site.shippingCenterId ? { shippingCenterId: site.shippingCenterId } : {}), ...(site.shippingCenter?.name ? { shippingCenterName: site.shippingCenter.name } : {}), ...(site.primaryContactName ? { primaryContactName: site.primaryContactName } : {}), ...(site.primaryContactEmail ? { primaryContactEmail: site.primaryContactEmail } : {}), ...(site.primaryContactPhone ? { primaryContactPhone: site.primaryContactPhone } : {}), ...(site.baselineEstablishedAt ? { baselineEstablishedAt: site.baselineEstablishedAt.toISOString() } : {}), ...(site.manualBaselineQuantity !== null ? { manualBaselineQuantity: site.manualBaselineQuantity } : {}), ...(site.lastAuditCompletedAt ? { lastAuditCompletedAt: site.lastAuditCompletedAt.toISOString() } : {}), ...(site.nextAuditDueAt ? { nextAuditDueAt: site.nextAuditDueAt.toISOString() } : {}), ...(site.activeSince ? { activeSince: site.activeSince.toISOString() } : {}), ...(site.exitedAt ? { exitedAt: site.exitedAt.toISOString() } : {}), ...(site.notes ? { notes: site.notes } : {}), formCounts, openWorkItemCount: site._count.workItems, openDiscrepancyCount: site._count.discrepancyCases, createdAt: site.createdAt.toISOString(), updatedAt: site.updatedAt.toISOString() };
}

function mapForm(form: { id: string; siteId: string; formType: ConsignmentFormType; status: ConsignmentFormStatus; title: string | null; documentUrl: string | null; externalRef: string | null; version: number; isCurrent: boolean; receivedAt: Date | null; signedAt: Date | null; approvedAt: Date | null; notes: string | null; createdAt: Date; updatedAt: Date }): ConsignmentFormSummary {
  return { id: form.id, siteId: form.siteId, formType: mapFormType(form.formType), status: mapFormStatus(form.status), ...(form.title ? { title: form.title } : {}), ...(form.documentUrl ? { documentUrl: form.documentUrl } : {}), ...(form.externalRef ? { externalRef: form.externalRef } : {}), version: form.version, isCurrent: form.isCurrent, ...(form.receivedAt ? { receivedAt: form.receivedAt.toISOString() } : {}), ...(form.signedAt ? { signedAt: form.signedAt.toISOString() } : {}), ...(form.approvedAt ? { approvedAt: form.approvedAt.toISOString() } : {}), ...(form.notes ? { notes: form.notes } : {}), createdAt: form.createdAt.toISOString(), updatedAt: form.updatedAt.toISOString() };
}

function mapAudit(audit: { id: string; siteId: string; scheduledFor: Date; startedAt: Date | null; completedAt: Date | null; status: ConsignmentAuditStatus; reconciliationStatus: ConsignmentReconciliationStatus; expectedSource: string; sourceFreshnessLabel: string; notes: string | null; createdAt: Date; updatedAt: Date; lines: Array<{ id: string; sku: string | null; barcode: string | null; productName: string; expectedQuantity: number | null; actualQuantity: number | null; varianceQuantity: number | null; notes: string | null }>; evidence?: Array<{ purpose: ConsignmentAuditEvidencePurpose }> }): ConsignmentAuditSummary {
  const evidence = audit.evidence ?? [];
  return { id: audit.id, siteId: audit.siteId, scheduledFor: audit.scheduledFor.toISOString(), ...(audit.startedAt ? { startedAt: audit.startedAt.toISOString() } : {}), ...(audit.completedAt ? { completedAt: audit.completedAt.toISOString() } : {}), status: audit.status.toLowerCase() as ConsignmentAuditSummary['status'], reconciliationStatus: audit.reconciliationStatus.toLowerCase() as ConsignmentAuditSummary['reconciliationStatus'], expectedSource: audit.expectedSource, sourceFreshnessLabel: audit.sourceFreshnessLabel, ...(audit.notes ? { notes: audit.notes } : {}), lines: audit.lines.map((line) => ({ id: line.id, ...(line.sku ? { sku: line.sku } : {}), ...(line.barcode ? { barcode: line.barcode } : {}), productName: line.productName, ...(line.expectedQuantity !== null ? { expectedQuantity: line.expectedQuantity } : {}), ...(line.actualQuantity !== null ? { actualQuantity: line.actualQuantity } : {}), ...(line.varianceQuantity !== null ? { varianceQuantity: line.varianceQuantity } : {}), ...(line.notes ? { notes: line.notes } : {}) })), evidenceCount: evidence.length, discrepancyEvidenceCount: evidence.filter((item) => item.purpose === ConsignmentAuditEvidencePurpose.DISCREPANCY).length, createdAt: audit.createdAt.toISOString(), updatedAt: audit.updatedAt.toISOString() };
}

function mapEvidence(evidence: { id: string; auditId: string; siteId: string; purpose: ConsignmentAuditEvidencePurpose; storageKey: string; fileName: string; mimeType: string; sizeBytes: number; sha256: string | null; notes: string | null; uploadedByUserId: string | null; uploadedBy?: { displayName: string | null } | null; uploadedAt: Date; createdAt: Date; updatedAt: Date }): ConsignmentAuditEvidenceSummary {
  return {
    id: evidence.id,
    auditId: evidence.auditId,
    siteId: evidence.siteId,
    purpose: evidence.purpose.toLowerCase() as ConsignmentAuditEvidenceSummary['purpose'],
    storageKey: evidence.storageKey,
    fileName: evidence.fileName,
    mimeType: evidence.mimeType,
    sizeBytes: evidence.sizeBytes,
    ...(evidence.sha256 ? { sha256: evidence.sha256 } : {}),
    ...(evidence.notes ? { notes: evidence.notes } : {}),
    ...(evidence.uploadedByUserId ? { uploadedByUserId: evidence.uploadedByUserId } : {}),
    ...(evidence.uploadedBy?.displayName ? { uploadedByName: evidence.uploadedBy.displayName } : {}),
    uploadedAt: evidence.uploadedAt.toISOString(),
    createdAt: evidence.createdAt.toISOString(),
    updatedAt: evidence.updatedAt.toISOString(),
  };
}

function snapshotSite(site: SiteWithRelations) {
  return { id: site.id, accountId: site.accountId, status: site.status, acumaticaStatus: site.acumaticaStatus, warehouseCode: site.warehouseCode, baselineEstablishedAt: site.baselineEstablishedAt, manualBaselineQuantity: site.manualBaselineQuantity, nextAuditDueAt: site.nextAuditDueAt };
}

function mapSiteStatus(status: ConsignmentSiteStatus): ConsignmentSiteStatusKey { return status.toLowerCase() as ConsignmentSiteStatusKey; }
function toSiteStatus(status: ConsignmentSiteStatusKey): ConsignmentSiteStatus { return status.toUpperCase() as ConsignmentSiteStatus; }
function mapFormType(type: ConsignmentFormType): ConsignmentFormTypeKey { return type.toLowerCase() as ConsignmentFormTypeKey; }
function toFormType(type: ConsignmentFormTypeKey): ConsignmentFormType { return type.toUpperCase() as ConsignmentFormType; }
function mapFormStatus(status: ConsignmentFormStatus): ConsignmentFormStatusKey { return status.toLowerCase() as ConsignmentFormStatusKey; }
function toFormStatus(status: ConsignmentFormStatusKey): ConsignmentFormStatus { return status.toUpperCase() as ConsignmentFormStatus; }
function toReconciliationStatus(status: string): ConsignmentReconciliationStatus { return status.toUpperCase() as ConsignmentReconciliationStatus; }
function toTrueUpOutcome(outcome: ConfirmConsignmentTrueUpRequest['outcome']) {
  if (outcome !== 'po_required' && outcome !== 'resolved_no_po' && outcome !== 'write_off') {
    throw new Error('outcome must be po_required, resolved_no_po, or write_off');
  }
  return outcome;
}
function toEvidencePurpose(purpose: ConsignmentAuditEvidencePurposeKey): ConsignmentAuditEvidencePurpose {
  if (purpose !== 'general' && purpose !== 'discrepancy') {
    throw new Error('purpose must be general or discrepancy');
  }
  return purpose.toUpperCase() as ConsignmentAuditEvidencePurpose;
}
function clampLimit(limit?: number) { return !limit || Number.isNaN(limit) ? DEFAULT_LIMIT : Math.max(1, Math.min(MAX_LIMIT, Math.trunc(limit))); }
function cleanOptional(value: string | undefined) { const trimmed = value?.trim(); return trimmed ? trimmed : undefined; }
function cleanNullable(value: string | null | undefined) { if (value === null) return null; const trimmed = value?.trim(); return trimmed ? trimmed : null; }
function normalizeNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value)) throw new Error(`${fieldName} must be a finite number`);
  const normalized = Math.trunc(value);
  if (normalized < 0) throw new Error(`${fieldName} must be a non-negative integer`);
  return normalized;
}
function buildTrueUpNotes(notes: string | undefined, outcome: ConfirmConsignmentTrueUpRequest['outcome']) {
  const prefix = outcome === 'po_required'
    ? 'True-up confirmed customer PO follow-up is required.'
    : outcome === 'write_off'
      ? 'True-up closed variance as write-off/waived PO follow-up.'
      : 'True-up resolved variance without customer PO follow-up.';
  const detail = cleanOptional(notes);
  return detail ? `${prefix} ${detail}` : prefix;
}
function buildAdjustmentNotes(notes: string | undefined) {
  const prefix = 'PURPLE adjustment applied to Pulse manual baseline. Acumatica inventory adjustment posting remains parked.';
  const detail = cleanOptional(notes);
  return detail ? `${prefix} ${detail}` : prefix;
}
function buildExitClosureNotes(notes: string | undefined) {
  const prefix = 'SAND exit closed in Pulse with manual reconciliation evidence. Acumatica settlement posting remains parked.';
  const detail = cleanOptional(notes);
  return detail ? `${prefix} ${detail}` : prefix;
}
function buildPoReceivedNotes(notes: string | undefined, receivedAt: Date) {
  const prefix = `PO follow-up marked received on ${receivedAt.toISOString()}. Acumatica receipt/order posting remains manual-reference only.`;
  const detail = cleanOptional(notes);
  return detail ? `${prefix} ${detail}` : prefix;
}
function appendNotes(existing: string | null | undefined, next: string) {
  return existing ? `${existing}\n${next}` : next;
}
function compact<T extends Record<string, unknown>>(value: T): T { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T; }
function parseRequiredDate(value: string, fieldName: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) throw new Error(`${fieldName} must be a valid ISO date`); return date; }
function parseOptionalDate(value: string | null | undefined) { return value ? parseRequiredDate(value, 'date') : undefined; }
function addDays(date: Date, days: number) { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next; }
function addBusinessDays(date: Date, days: number) { const next = new Date(date); let remaining = days; while (remaining > 0) { next.setUTCDate(next.getUTCDate() + 1); const day = next.getUTCDay(); if (day !== 0 && day !== 6) remaining -= 1; } return next; }
function computeVariance(expected?: number, actual?: number) { return expected === undefined || actual === undefined ? undefined : actual - expected; }
function estimateBase64DecodedSize(value: string) { const normalized = value.trim().replace(/\s+/g, ''); const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0; return Math.floor((normalized.length * 3) / 4) - padding; }
function buildConsignmentEvidenceStorageKey(auditId: string, fileName: string) { return `consignment/audits/${auditId}/evidence/${Date.now()}-${sanitizeFileName(fileName)}`; }
function sanitizeFileName(fileName: string) { return fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'rose-evidence.jpg'; }
