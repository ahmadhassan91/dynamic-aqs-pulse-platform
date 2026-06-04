import {
  assertActionAccess,
  assertModuleAccess,
} from '@pulse/auth';
import {
  AuditAction,
  ConsignmentAcumaticaStatus,
  ConsignmentAuditEvidencePurpose,
  ConsignmentAuditStatus,
  ConsignmentDiscrepancyStatus,
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
  CompleteConsignmentAuditRequest,
  ConsignmentAccountReadModel,
  ConsignmentAuditEvidenceSummary,
  ConsignmentAuditEvidencePurposeKey,
  ConsignmentAuditSummary,
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
  CreateConsignmentAuditRequest,
  CreateConsignmentSiteRequest,
  ListConsignmentSitesRequest,
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
      const poDueAt = addBusinessDays(completedAt, PO_CLOCK_BUSINESS_DAYS);
      const existingDiscrepancy = await tx.consignmentDiscrepancyCase.findFirst({ where: { auditId } });
      if (!existingDiscrepancy) {
        await tx.consignmentDiscrepancyCase.create({ data: { siteId, auditId, status: ConsignmentDiscrepancyStatus.OPEN, poFollowUpStatus: ConsignmentPoFollowUpStatus.REQUIRED, trueUpConfirmedAt: completedAt, poDueAt, notes: 'Created from ROSE audit variance. Acumatica PO/order posting remains parked.' } });
      }
      const existingPoFollowUp = await tx.consignmentWorkItem.findFirst({
        where: {
          siteId,
          type: ConsignmentWorkItemType.PO_FOLLOW_UP,
          status: { in: [ConsignmentWorkItemStatus.OPEN, ConsignmentWorkItemStatus.IN_PROGRESS, ConsignmentWorkItemStatus.BLOCKED] },
          title: 'Follow up on consignment variance PO within 5 business days',
        },
      });
      if (!existingPoFollowUp) {
        await tx.consignmentWorkItem.create({ data: { siteId, type: ConsignmentWorkItemType.PO_FOLLOW_UP, status: ConsignmentWorkItemStatus.OPEN, title: 'Follow up on consignment variance PO within 5 business days', dueAt: poDueAt, notes: 'Track manual PO follow-up in Pulse; do not auto-create Acumatica PO.' } });
      }
    }
    await tx.auditEntry.create({ data: buildAuditEntryData({ actorUserId: actor.userId, action: AuditAction.UPDATE, entityType: 'CONSIGNMENT_AUDIT', entityId: row.id, afterData: row, metadata: { generatedDiscrepancy: hasVariance, acumaticaPoCreation: 'parked' } }) });
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
  return { ...mapSiteSummary(site), forms: site.forms.map(mapForm), audits: site.audits.map(mapAudit), workItems: site.workItems.map((item) => ({ id: item.id, siteId: item.siteId, type: item.type.toLowerCase(), status: item.status.toLowerCase(), priority: item.priority, title: item.title, ...(item.assignedToUserId ? { assignedToUserId: item.assignedToUserId } : {}), ...(item.dueAt ? { dueAt: item.dueAt.toISOString() } : {}), ...(item.completedAt ? { completedAt: item.completedAt.toISOString() } : {}), ...(item.notes ? { notes: item.notes } : {}), createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })), fieldActivity: site.mobileVoiceNotes.map(mapFieldActivityNote) };
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
  return { id: site.id, accountId: site.accountId, accountName: site.account.displayName, ...(site.locationId ? { locationId: site.locationId } : {}), ...(site.location?.name ? { locationName: site.location.name } : {}), ...(site.location?.city ? { locationCity: site.location.city } : {}), ...(site.location?.state ? { locationState: site.location.state } : {}), name: site.name, status: mapSiteStatus(site.status), acumaticaStatus: site.acumaticaStatus.toLowerCase() as ConsignmentSiteSummary['acumaticaStatus'], ...(site.warehouseCode ? { warehouseCode: site.warehouseCode } : {}), ...(site.acumaticaWarehouseId ? { acumaticaWarehouseId: site.acumaticaWarehouseId } : {}), ...(site.acumaticaLastSyncedAt ? { acumaticaLastSyncedAt: site.acumaticaLastSyncedAt.toISOString() } : {}), ...(site.acumaticaLastError ? { acumaticaLastError: site.acumaticaLastError } : {}), ...(site.ownerTmUserId ? { ownerTmUserId: site.ownerTmUserId } : {}), ...(site.ownerTmUser?.displayName ? { ownerTmName: site.ownerTmUser.displayName } : {}), ...(site.ownerRdUserId ? { ownerRdUserId: site.ownerRdUserId } : {}), ...(site.ownerRdUser?.displayName ? { ownerRdName: site.ownerRdUser.displayName } : {}), ...(site.territoryId ? { territoryId: site.territoryId } : {}), ...(site.territory?.name ? { territoryName: site.territory.name } : {}), ...(site.regionId ? { regionId: site.regionId } : {}), ...(site.region?.name ? { regionName: site.region.name } : {}), ...(site.shippingCenterId ? { shippingCenterId: site.shippingCenterId } : {}), ...(site.shippingCenter?.name ? { shippingCenterName: site.shippingCenter.name } : {}), ...(site.primaryContactName ? { primaryContactName: site.primaryContactName } : {}), ...(site.primaryContactEmail ? { primaryContactEmail: site.primaryContactEmail } : {}), ...(site.primaryContactPhone ? { primaryContactPhone: site.primaryContactPhone } : {}), ...(site.baselineEstablishedAt ? { baselineEstablishedAt: site.baselineEstablishedAt.toISOString() } : {}), ...(site.lastAuditCompletedAt ? { lastAuditCompletedAt: site.lastAuditCompletedAt.toISOString() } : {}), ...(site.nextAuditDueAt ? { nextAuditDueAt: site.nextAuditDueAt.toISOString() } : {}), ...(site.activeSince ? { activeSince: site.activeSince.toISOString() } : {}), ...(site.exitedAt ? { exitedAt: site.exitedAt.toISOString() } : {}), ...(site.notes ? { notes: site.notes } : {}), formCounts, openWorkItemCount: site._count.workItems, openDiscrepancyCount: site._count.discrepancyCases, createdAt: site.createdAt.toISOString(), updatedAt: site.updatedAt.toISOString() };
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
  return { id: site.id, accountId: site.accountId, status: site.status, acumaticaStatus: site.acumaticaStatus, warehouseCode: site.warehouseCode, baselineEstablishedAt: site.baselineEstablishedAt, nextAuditDueAt: site.nextAuditDueAt };
}

function mapSiteStatus(status: ConsignmentSiteStatus): ConsignmentSiteStatusKey { return status.toLowerCase() as ConsignmentSiteStatusKey; }
function toSiteStatus(status: ConsignmentSiteStatusKey): ConsignmentSiteStatus { return status.toUpperCase() as ConsignmentSiteStatus; }
function mapFormType(type: ConsignmentFormType): ConsignmentFormTypeKey { return type.toLowerCase() as ConsignmentFormTypeKey; }
function toFormType(type: ConsignmentFormTypeKey): ConsignmentFormType { return type.toUpperCase() as ConsignmentFormType; }
function mapFormStatus(status: ConsignmentFormStatus): ConsignmentFormStatusKey { return status.toLowerCase() as ConsignmentFormStatusKey; }
function toFormStatus(status: ConsignmentFormStatusKey): ConsignmentFormStatus { return status.toUpperCase() as ConsignmentFormStatus; }
function toReconciliationStatus(status: string): ConsignmentReconciliationStatus { return status.toUpperCase() as ConsignmentReconciliationStatus; }
function toEvidencePurpose(purpose: ConsignmentAuditEvidencePurposeKey): ConsignmentAuditEvidencePurpose {
  if (purpose !== 'general' && purpose !== 'discrepancy') {
    throw new Error('purpose must be general or discrepancy');
  }
  return purpose.toUpperCase() as ConsignmentAuditEvidencePurpose;
}
function clampLimit(limit?: number) { return !limit || Number.isNaN(limit) ? DEFAULT_LIMIT : Math.max(1, Math.min(MAX_LIMIT, Math.trunc(limit))); }
function cleanOptional(value: string | undefined) { const trimmed = value?.trim(); return trimmed ? trimmed : undefined; }
function cleanNullable(value: string | null | undefined) { if (value === null) return null; const trimmed = value?.trim(); return trimmed ? trimmed : null; }
function compact<T extends Record<string, unknown>>(value: T): T { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T; }
function parseRequiredDate(value: string, fieldName: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) throw new Error(`${fieldName} must be a valid ISO date`); return date; }
function parseOptionalDate(value: string | null | undefined) { return value ? parseRequiredDate(value, 'date') : undefined; }
function addDays(date: Date, days: number) { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next; }
function addBusinessDays(date: Date, days: number) { const next = new Date(date); let remaining = days; while (remaining > 0) { next.setUTCDate(next.getUTCDate() + 1); const day = next.getUTCDay(); if (day !== 0 && day !== 6) remaining -= 1; } return next; }
function computeVariance(expected?: number, actual?: number) { return expected === undefined || actual === undefined ? undefined : actual - expected; }
function estimateBase64DecodedSize(value: string) { const normalized = value.trim().replace(/\s+/g, ''); const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0; return Math.floor((normalized.length * 3) / 4) - padding; }
function buildConsignmentEvidenceStorageKey(auditId: string, fileName: string) { return `consignment/audits/${auditId}/evidence/${Date.now()}-${sanitizeFileName(fileName)}`; }
function sanitizeFileName(fileName: string) { return fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'rose-evidence.jpg'; }
