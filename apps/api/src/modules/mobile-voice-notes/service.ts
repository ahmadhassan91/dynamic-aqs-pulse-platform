import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { assertActionAccess, canPerformAction } from '@pulse/auth';
import {
  AuditAction,
  ConsignmentWorkItemStatus,
  ConsignmentWorkItemType,
  MobileVoiceNoteContextType,
  MobileVoiceNoteProcessingStatus,
  MobileVoiceNoteReviewStatus,
  Prisma,
  prisma,
} from '@pulse/db';
import type {
  CreateMobileVoiceNoteRequest,
  ListMobileVoiceNoteReviewQueueRequest,
  ListMobileVoiceNotesRequest,
  ListMobileVoiceNotesResponse,
  MobileVoiceNoteContextTypeKey,
  MobileVoiceNoteFollowUpPriorityKey,
  MobileVoiceNoteReviewActionKey,
  MobileVoiceNoteProcessingStatusKey,
  MobileVoiceNoteReviewStatusKey,
  MobileVoiceNoteStructuredData,
  MobileVoiceNoteSummary,
  ReviewMobileVoiceNoteRequest,
} from '@pulse/contracts/mobile-voice-notes';
import type { AppConfig } from '../../config.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import type { AuthenticatedActor } from '../auth/types.js';
import { storeBase64Document } from '../documents/storage.js';
import { getAccountDetail } from '../accounts/service.js';
import { getLeadDetail } from '../leads/service.js';
import { buildTrainingSessionRecordScope } from '../auth/visibility.js';
import { buildConsignmentSiteScopeWhere } from '../consignment/service.js';
import { structureVoiceNote } from './llm.js';

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const MAX_TRANSCRIPT_CHARS = 12_000;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_FOLLOW_UP_TITLE = 'Review mobile field note follow-up';

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/aac',
  'audio/m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
]);

const contextToPrisma: Record<MobileVoiceNoteContextTypeKey, MobileVoiceNoteContextType> = {
  general: MobileVoiceNoteContextType.GENERAL,
  lead: MobileVoiceNoteContextType.LEAD,
  account: MobileVoiceNoteContextType.ACCOUNT,
  training_session: MobileVoiceNoteContextType.TRAINING_SESSION,
  consignment_site: MobileVoiceNoteContextType.CONSIGNMENT_SITE,
  route_visit: MobileVoiceNoteContextType.ROUTE_VISIT,
};

const contextFromPrisma: Record<MobileVoiceNoteContextType, MobileVoiceNoteContextTypeKey> = {
  GENERAL: 'general',
  LEAD: 'lead',
  ACCOUNT: 'account',
  TRAINING_SESSION: 'training_session',
  CONSIGNMENT_SITE: 'consignment_site',
  ROUTE_VISIT: 'route_visit',
};

const statusToPrisma: Record<MobileVoiceNoteProcessingStatusKey, MobileVoiceNoteProcessingStatus> = {
  pending: MobileVoiceNoteProcessingStatus.PENDING,
  structured: MobileVoiceNoteProcessingStatus.STRUCTURED,
  needs_review: MobileVoiceNoteProcessingStatus.NEEDS_REVIEW,
  failed: MobileVoiceNoteProcessingStatus.FAILED,
};

const statusFromPrisma: Record<MobileVoiceNoteProcessingStatus, MobileVoiceNoteProcessingStatusKey> = {
  PENDING: 'pending',
  STRUCTURED: 'structured',
  NEEDS_REVIEW: 'needs_review',
  FAILED: 'failed',
};

const reviewStatusToPrisma: Record<MobileVoiceNoteReviewStatusKey, MobileVoiceNoteReviewStatus> = {
  pending_review: MobileVoiceNoteReviewStatus.PENDING_REVIEW,
  approved: MobileVoiceNoteReviewStatus.APPROVED,
  rejected: MobileVoiceNoteReviewStatus.REJECTED,
};

const reviewStatusFromPrisma: Record<MobileVoiceNoteReviewStatus, MobileVoiceNoteReviewStatusKey> = {
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const voiceNoteInclude = {
  account: { select: { displayName: true } },
  consignmentSite: { select: { name: true } },
  createdBy: { select: { displayName: true } },
  lead: { select: { companyName: true, contactDisplayName: true } },
  reviewedBy: { select: { displayName: true } },
  trainingSession: { select: { title: true } },
} satisfies Prisma.MobileVoiceNoteInclude;

type VoiceNoteRow = Prisma.MobileVoiceNoteGetPayload<{ include: typeof voiceNoteInclude }>;

export async function createMobileVoiceNote(
  config: AppConfig,
  actor: AuthenticatedActor,
  input: CreateMobileVoiceNoteRequest,
): Promise<MobileVoiceNoteSummary> {
  const contextType = inferContextType(input);
  const transcriptText = normalizeTranscript(input.transcriptText);
  if (!transcriptText && !input.audio?.contentBase64) {
    throw new Error('Voice note requires either a transcript or an audio file.');
  }

  await assertContextAccess(actor, input);

  const audio = await storeAudioIfPresent(config, input.audio);
  const structured = await structureVoiceNote(config, {
    transcriptText,
    audio: input.audio ? {
      contentBase64: input.audio.contentBase64,
      fileName: input.audio.fileName,
      mimeType: input.audio.mimeType,
    } : undefined,
  });
  const recordedAt = parseOptionalDate(input.recordedAt) ?? new Date();
  const title = normalizeTitle(input.title)
    ?? buildTitle(contextType, structured.structuredData?.summary ?? structured.rawTranscript);
  const processingStatus = structured.status === 'structured' ? 'structured' : structured.status === 'failed' ? 'failed' : 'needs_review';
  const createData: Prisma.MobileVoiceNoteUncheckedCreateInput = {
    contextType: toPrismaContext(contextType),
    createdByUserId: actor.userId,
    title,
    structuredTags: structured.structuredData?.tags ?? [],
    processingStatus: toPrismaStatus(processingStatus),
    llmProvider: structured.provider,
    recordedAt,
    crmSyncedAt: new Date(),
    ...compactString('leadId', input.leadId),
    ...compactString('accountId', input.accountId),
    ...compactString('trainingSessionId', input.trainingSessionId),
    ...compactString('consignmentSiteId', input.consignmentSiteId),
    ...compactString('routeVisitLocalId', input.routeVisitLocalId),
    ...audio,
  };
  if (structured.rawTranscript) createData.rawTranscript = structured.rawTranscript;
  if (structured.structuredData?.summary) createData.structuredSummary = structured.structuredData.summary;
  if (structured.structuredData?.nextStep) createData.structuredNextStep = structured.structuredData.nextStep;
  if (structured.structuredData?.sentiment) createData.structuredSentiment = structured.structuredData.sentiment;
  if (structured.structuredData) createData.structuredData = structured.structuredData as Prisma.InputJsonValue;
  if (structured.model) createData.llmModel = structured.model;
  if (structured.errorMessage) createData.llmErrorMessage = structured.errorMessage;

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.mobileVoiceNote.create({
      data: createData,
      include: voiceNoteInclude,
    }) as VoiceNoteRow;

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: 'MOBILE_VOICE_NOTE',
        entityId: created.id,
        afterData: snapshotVoiceNote(created),
        metadata: {
          module: 'mobile',
          operation: 'voice_note_sync',
          llmProvider: structured.provider,
          llmStatus: processingStatus,
          storageOwner: 'pulse_crm',
          coreWritebackPolicy: 'parked_until_dynamic_confirms_review_rules',
          acumaticaBoundary: 'not_an_acumatica_note',
        },
      }),
    });

    return created;
  });

  return mapVoiceNote(row);
}

export async function listMobileVoiceNotes(
  actor: AuthenticatedActor,
  input: ListMobileVoiceNotesRequest = {},
): Promise<ListMobileVoiceNotesResponse> {
  await assertContextAccess(actor, input);
  const limit = clampLimit(input.limit);
  const where: Prisma.MobileVoiceNoteWhereInput = {
    createdByUserId: actor.userId,
    ...compactEnumFilter(input.contextType),
    ...compactProcessingStatusFilter(input.processingStatus),
    ...compactReviewStatusFilter(input.reviewStatus),
    ...compactString('leadId', input.leadId),
    ...compactString('accountId', input.accountId),
    ...compactString('trainingSessionId', input.trainingSessionId),
    ...compactString('consignmentSiteId', input.consignmentSiteId),
  };
  const [items, total] = await Promise.all([
    prisma.mobileVoiceNote.findMany({
      where,
      include: voiceNoteInclude,
      orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    }),
    prisma.mobileVoiceNote.count({ where }),
  ]);

  return {
    items: items.map(mapVoiceNote),
    total,
  };
}

export async function listMobileVoiceNoteReviewQueue(
  actor: AuthenticatedActor,
  input: ListMobileVoiceNoteReviewQueueRequest = {},
): Promise<ListMobileVoiceNotesResponse> {
  assertCanUseReviewQueue(actor);
  const limit = clampLimit(input.limit);
  const where = buildReviewQueueWhere(input);
  const candidates = await prisma.mobileVoiceNote.findMany({
    where,
    include: voiceNoteInclude,
    orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }],
    take: Math.min(MAX_LIMIT, limit * 4),
  });

  const visible: MobileVoiceNoteSummary[] = [];
  for (const row of candidates) {
    if (await canActorAccessVoiceNote(actor, row)) {
      visible.push(mapVoiceNote(row));
    }
    if (visible.length >= limit) break;
  }

  return {
    items: visible,
    total: visible.length,
  };
}

export async function getMobileVoiceNoteDetail(
  actor: AuthenticatedActor,
  voiceNoteId: string,
): Promise<MobileVoiceNoteSummary | null> {
  assertCanUseReviewQueue(actor);
  const row = await prisma.mobileVoiceNote.findUnique({
    where: { id: voiceNoteId },
    include: voiceNoteInclude,
  }) as VoiceNoteRow | null;
  if (!row) return null;
  if (!(await canActorAccessVoiceNote(actor, row))) return null;
  return mapVoiceNote(row);
}

export async function reviewMobileVoiceNote(
  actor: AuthenticatedActor,
  voiceNoteId: string,
  input: ReviewMobileVoiceNoteRequest,
): Promise<MobileVoiceNoteSummary> {
  assertCanUseReviewQueue(actor);
  const current = await prisma.mobileVoiceNote.findUnique({
    where: { id: voiceNoteId },
    include: voiceNoteInclude,
  }) as VoiceNoteRow | null;
  if (!current) throw new Error('Voice note was not found.');
  if (!(await canActorAccessVoiceNote(actor, current))) {
    throw new Error('Voice note is not available for this reviewer.');
  }
  if (current.reviewStatus !== MobileVoiceNoteReviewStatus.PENDING_REVIEW) {
    throw new Error('Voice note has already been reviewed.');
  }

  const decision = normalizeReviewDecision(input.decision);
  const reviewNotes = normalizeReviewText(input.reviewNotes, 1000);
  const rejectedReason = normalizeReviewText(input.rejectedReason, 600);
  if (decision === 'reject' && !reviewNotes && !rejectedReason) {
    throw new Error('Rejecting a voice note requires a review note or rejection reason.');
  }
  if (decision === 'reject' && input.writebackAction && input.writebackAction !== 'activity_only') {
    throw new Error('Follow-up actions are only available when approving a voice note.');
  }

  const now = new Date();
  const updateData = buildReviewUpdateData(current, input, decision, actor.userId, now, reviewNotes, rejectedReason);
  const requestedWritebackAction = decision === 'approve'
    ? normalizeReviewWritebackAction(input.writebackAction)
    : 'activity_only';

  const reviewed = await prisma.$transaction(async (tx) => {
    let updated = await tx.mobileVoiceNote.update({
      where: { id: current.id },
      data: updateData,
      include: voiceNoteInclude,
    }) as VoiceNoteRow;

    const writeback = decision === 'approve'
      ? await applyApprovedVoiceNoteWriteback(tx, actor, updated, input, requestedWritebackAction, now)
      : {};
    if (writeback.writebackTarget) {
      updated = await tx.mobileVoiceNote.update({
        where: { id: current.id },
        data: {
          writebackCompletedAt: now,
          writebackTarget: writeback.writebackTarget,
        },
        include: voiceNoteInclude,
      }) as VoiceNoteRow;
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: decision === 'approve' ? AuditAction.APPROVE : AuditAction.REJECT,
        entityType: 'MOBILE_VOICE_NOTE',
        entityId: updated.id,
        beforeData: snapshotVoiceNote(current),
        afterData: snapshotVoiceNote(updated),
        metadata: {
          module: 'field_activity',
          operation: decision === 'approve' ? 'voice_note_approved' : 'voice_note_rejected',
          sourceSystem: 'pulse_mobile',
          writebackAction: requestedWritebackAction,
          writebackTarget: writeback.writebackTarget ?? 'none',
          createdEntityType: writeback.createdEntityType,
          createdEntityId: writeback.createdEntityId,
          acumaticaBoundary: 'not_an_acumatica_note',
        },
      }),
    });

    if (decision === 'approve' && writeback.activityTarget) {
      await writeApprovedVoiceNoteActivity(tx, actor, updated, writeback.activityTarget, writeback);
    }

    return updated;
  });

  return mapVoiceNote(reviewed);
}

async function assertContextAccess(
  actor: AuthenticatedActor,
  input: Pick<CreateMobileVoiceNoteRequest, 'accountId' | 'consignmentSiteId' | 'leadId' | 'trainingSessionId'>,
) {
  if (input.accountId) {
    const account = await getAccountDetail(actor, input.accountId);
    if (!account) throw new Error('Account is not available for this mobile user.');
  }
  if (input.leadId) {
    const lead = await getLeadDetail(actor, input.leadId);
    if (!lead) throw new Error('Lead is not available for this mobile user.');
  }
  if (input.trainingSessionId) {
    const session = await prisma.trainingSession.findUnique({
      where: { id: input.trainingSessionId },
      select: { id: true },
    });
    if (!session) throw new Error('Training session was not found.');
  }
  if (input.consignmentSiteId) {
    const site = await prisma.consignmentSite.findUnique({
      where: { id: input.consignmentSiteId },
      select: { id: true },
    });
    if (!site) throw new Error('Consignment site was not found.');
  }
}

async function storeAudioIfPresent(
  config: AppConfig,
  audio: CreateMobileVoiceNoteRequest['audio'],
): Promise<Partial<Prisma.MobileVoiceNoteUncheckedCreateInput>> {
  if (!audio) return {};
  const mimeType = audio.mimeType.trim().toLowerCase();
  if (!ALLOWED_AUDIO_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported voice note audio type: ${audio.mimeType}`);
  }
  const decodedBytes = Buffer.from(audio.contentBase64, 'base64').byteLength;
  if (!decodedBytes) {
    throw new Error('Voice note audio must decode to a non-empty file.');
  }
  if (decodedBytes > MAX_AUDIO_BYTES) {
    throw new Error('Voice note audio is too large. Keep recordings under 5 MB for this mobile slice.');
  }

  const fileName = sanitizeFileName(audio.fileName || `voice-note.${extensionForMimeType(mimeType)}`);
  const storageKey = path.posix.join(
    'mobile-voice-notes',
    new Date().toISOString().slice(0, 10),
    `${randomUUID()}.${extensionForMimeType(mimeType)}`,
  );
  const stored = await storeBase64Document(config, {
    storageKey,
    contentBase64: audio.contentBase64,
  });

  const result: Partial<Prisma.MobileVoiceNoteUncheckedCreateInput> = {
    audioStorageKey: storageKey,
    audioFileName: fileName,
    audioMimeType: mimeType,
    audioSizeBytes: stored.sizeBytes,
    audioSha256: stored.sha256,
  };
  const durationSeconds = normalizeDuration(audio.durationSeconds);
  if (durationSeconds !== undefined) result.durationSeconds = durationSeconds;
  return result;
}

function inferContextType(input: CreateMobileVoiceNoteRequest): MobileVoiceNoteContextTypeKey {
  if (input.contextType) return input.contextType;
  if (input.leadId) return 'lead';
  if (input.accountId) return 'account';
  if (input.trainingSessionId) return 'training_session';
  if (input.consignmentSiteId) return 'consignment_site';
  if (input.routeVisitLocalId) return 'route_visit';
  return 'general';
}

function mapVoiceNote(row: VoiceNoteRow): MobileVoiceNoteSummary {
  return {
    id: row.id,
    contextType: contextFromPrisma[row.contextType],
    title: row.title,
    structuredTags: row.structuredTags,
    processingStatus: statusFromPrisma[row.processingStatus],
    reviewStatus: reviewStatusFromPrisma[row.reviewStatus],
    recordedAt: row.recordedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.createdByUserId ? { createdByUserId: row.createdByUserId } : {}),
    ...(row.createdBy?.displayName ? { createdByName: row.createdBy.displayName } : {}),
    ...(row.reviewedByUserId ? { reviewedByUserId: row.reviewedByUserId } : {}),
    ...(row.reviewedBy?.displayName ? { reviewedByName: row.reviewedBy.displayName } : {}),
    ...(row.reviewedAt ? { reviewedAt: row.reviewedAt.toISOString() } : {}),
    ...(row.reviewNotes ? { reviewNotes: row.reviewNotes } : {}),
    ...(row.rejectedReason ? { rejectedReason: row.rejectedReason } : {}),
    ...(row.writebackCompletedAt ? { writebackCompletedAt: row.writebackCompletedAt.toISOString() } : {}),
    ...(row.writebackTarget ? { writebackTarget: row.writebackTarget } : {}),
    ...(row.leadId ? { leadId: row.leadId } : {}),
    ...(row.lead ? { leadName: row.lead.companyName || row.lead.contactDisplayName } : {}),
    ...(row.accountId ? { accountId: row.accountId } : {}),
    ...(row.account?.displayName ? { accountName: row.account.displayName } : {}),
    ...(row.trainingSessionId ? { trainingSessionId: row.trainingSessionId } : {}),
    ...(row.trainingSession?.title ? { trainingSessionTitle: row.trainingSession.title } : {}),
    ...(row.consignmentSiteId ? { consignmentSiteId: row.consignmentSiteId } : {}),
    ...(row.consignmentSite?.name ? { consignmentSiteName: row.consignmentSite.name } : {}),
    ...(row.routeVisitLocalId ? { routeVisitLocalId: row.routeVisitLocalId } : {}),
    ...(row.rawTranscript ? { rawTranscript: row.rawTranscript } : {}),
    ...(row.structuredSummary ? { structuredSummary: row.structuredSummary } : {}),
    ...(row.structuredNextStep ? { structuredNextStep: row.structuredNextStep } : {}),
    ...(row.structuredSentiment ? { structuredSentiment: row.structuredSentiment } : {}),
    ...(row.structuredData ? { structuredData: row.structuredData as MobileVoiceNoteStructuredData } : {}),
    ...(row.llmProvider ? { llmProvider: row.llmProvider } : {}),
    ...(row.llmModel ? { llmModel: row.llmModel } : {}),
    ...(row.llmErrorMessage ? { llmErrorMessage: row.llmErrorMessage } : {}),
    ...(row.audioFileName ? { audioFileName: row.audioFileName } : {}),
    ...(row.audioMimeType ? { audioMimeType: row.audioMimeType } : {}),
    ...(row.audioSizeBytes !== null ? { audioSizeBytes: row.audioSizeBytes } : {}),
    ...(row.durationSeconds !== null ? { durationSeconds: row.durationSeconds } : {}),
    ...(row.crmSyncedAt ? { crmSyncedAt: row.crmSyncedAt.toISOString() } : {}),
  };
}

function snapshotVoiceNote(row: VoiceNoteRow) {
  return {
    id: row.id,
    contextType: contextFromPrisma[row.contextType],
    leadId: row.leadId,
    accountId: row.accountId,
    trainingSessionId: row.trainingSessionId,
    consignmentSiteId: row.consignmentSiteId,
    routeVisitLocalId: row.routeVisitLocalId,
    title: row.title,
    processingStatus: statusFromPrisma[row.processingStatus],
    reviewStatus: reviewStatusFromPrisma[row.reviewStatus],
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt?.toISOString(),
    writebackCompletedAt: row.writebackCompletedAt?.toISOString(),
    writebackTarget: row.writebackTarget,
    llmProvider: row.llmProvider,
    llmModel: row.llmModel,
    audioFileName: row.audioFileName,
    audioMimeType: row.audioMimeType,
    audioSizeBytes: row.audioSizeBytes,
    recordedAt: row.recordedAt.toISOString(),
  };
}

function normalizeTranscript(value: string | undefined) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  if (normalized.length > MAX_TRANSCRIPT_CHARS) {
    throw new Error(`Voice note transcript is too long. Keep it under ${MAX_TRANSCRIPT_CHARS} characters.`);
  }
  return normalized;
}

function normalizeTitle(value: string | undefined) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 140) : undefined;
}

function buildTitle(contextType: MobileVoiceNoteContextTypeKey, text: string | undefined) {
  const prefix = contextType === 'general' ? 'Voice note' : `${contextType.replace(/_/g, ' ')} note`;
  const snippet = text?.replace(/\s+/g, ' ').trim().slice(0, 60);
  return snippet ? `${prefix}: ${snippet}` : prefix;
}

function parseOptionalDate(value: string | undefined) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('recordedAt must be a valid ISO date.');
  }
  return parsed;
}

function sanitizeFileName(value: string) {
  const normalized = value.replace(/[^\w.\- ]+/g, '_').trim();
  return normalized.slice(0, 160) || 'voice-note.m4a';
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === 'audio/webm') return 'webm';
  if (mimeType === 'audio/mpeg') return 'mp3';
  if (mimeType === 'audio/wav') return 'wav';
  if (mimeType === 'audio/aac') return 'aac';
  return 'm4a';
}

function normalizeDuration(value: number | undefined) {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

function clampLimit(value: number | undefined) {
  if (!value || value < 1) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(value));
}

function buildReviewQueueWhere(input: ListMobileVoiceNoteReviewQueueRequest): Prisma.MobileVoiceNoteWhereInput {
  const search = normalizeSearch(input.search);
  return {
    ...compactEnumFilter(input.contextType),
    ...compactProcessingStatusFilter(input.processingStatus),
    ...compactReviewStatusFilter(input.reviewStatus ?? 'pending_review'),
    ...compactString('leadId', input.leadId),
    ...compactString('accountId', input.accountId),
    ...compactString('trainingSessionId', input.trainingSessionId),
    ...compactString('consignmentSiteId', input.consignmentSiteId),
    ...compactString('createdByUserId', input.createdByUserId),
    ...(search ? {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { rawTranscript: { contains: search, mode: 'insensitive' } },
        { structuredSummary: { contains: search, mode: 'insensitive' } },
        { account: { displayName: { contains: search, mode: 'insensitive' } } },
        { lead: { companyName: { contains: search, mode: 'insensitive' } } },
        { lead: { contactDisplayName: { contains: search, mode: 'insensitive' } } },
        { createdBy: { displayName: { contains: search, mode: 'insensitive' } } },
      ],
    } satisfies Prisma.MobileVoiceNoteWhereInput : {}),
  };
}

function assertCanUseReviewQueue(actor: AuthenticatedActor) {
  if (actor.actorType === 'dealer') {
    throw new Error('Dealer users cannot review field activity.');
  }
  if (
    !canPerformAction(actor.role, 'customer.activity_log')
    && !canPerformAction(actor.role, 'lead.view')
    && !canPerformAction(actor.role, 'training.schedule')
    && !canPerformAction(actor.role, 'consignment.view')
  ) {
    throw new Error('Field activity review requires customer, lead, training, or consignment access.');
  }
}

async function canActorAccessVoiceNote(actor: AuthenticatedActor, row: VoiceNoteRow) {
  try {
    if (row.accountId) {
      return Boolean(await getAccountDetail(actor, row.accountId));
    }
    if (row.leadId) {
      return Boolean(await getLeadDetail(actor, row.leadId));
    }
    if (row.trainingSessionId) {
      if (row.createdByUserId === actor.userId) {
        return true;
      }
      if (!canPerformAction(actor.role, 'training.schedule')) {
        return false;
      }
      // Record-scope (not just action-gate): the training session must be in the actor's book, mirroring
      // the account/lead branches above. Prevents a TM/RD reading a note for a session outside their scope.
      const scope = buildTrainingSessionRecordScope(actor);
      const visible = await prisma.trainingSession.findFirst({
        where: scope ? { AND: [scope, { id: row.trainingSessionId }] } : { id: row.trainingSessionId },
        select: { id: true },
      });
      return Boolean(visible);
    }
    if (row.consignmentSiteId) {
      if (row.createdByUserId === actor.userId) {
        return true;
      }
      if (!canPerformAction(actor.role, 'consignment.view')) {
        return false;
      }
      // Record-scope the consignment site to the actor's owned/region book.
      const visible = await prisma.consignmentSite.findFirst({
        where: { AND: [buildConsignmentSiteScopeWhere(actor), { id: row.consignmentSiteId }] },
        select: { id: true },
      });
      return Boolean(visible);
    }
    return row.createdByUserId === actor.userId || canReviewGeneralVoiceNotes(actor);
  } catch {
    return false;
  }
}

function canReviewGeneralVoiceNotes(actor: AuthenticatedActor) {
  return actor.role === 'SUPER_ADMIN'
    || actor.role === 'EXECUTIVE'
    || actor.role === 'ADMIN_CSR_OPS'
    || actor.role === 'SALES_BD_LEADERSHIP'
    || actor.role === 'REGIONAL_DIRECTOR';
}

function normalizeReviewDecision(value: ReviewMobileVoiceNoteRequest['decision']) {
  if (value === 'approve' || value === 'reject') return value;
  throw new Error('Review decision must be approve or reject.');
}

function buildReviewUpdateData(
  row: VoiceNoteRow,
  input: ReviewMobileVoiceNoteRequest,
  decision: ReviewMobileVoiceNoteRequest['decision'],
  reviewedByUserId: string,
  reviewedAt: Date,
  reviewNotes: string | undefined,
  rejectedReason: string | undefined,
): Prisma.MobileVoiceNoteUncheckedUpdateInput {
  const structuredData = buildReviewedStructuredData(row, input);
  const data: Prisma.MobileVoiceNoteUncheckedUpdateInput = {
    reviewStatus: decision === 'approve' ? MobileVoiceNoteReviewStatus.APPROVED : MobileVoiceNoteReviewStatus.REJECTED,
    reviewedByUserId,
    reviewedAt,
    processingStatus: decision === 'approve' ? MobileVoiceNoteProcessingStatus.STRUCTURED : row.processingStatus,
  };
  const title = normalizeTitle(input.title);
  const rawTranscript = normalizeTranscript(input.rawTranscript);
  const summary = normalizeReviewText(input.structuredSummary ?? row.structuredSummary, 800);
  const nextStep = normalizeReviewText(input.structuredNextStep ?? row.structuredNextStep, 500);
  const sentiment = normalizeSentiment(input.structuredSentiment ?? row.structuredSentiment);
  const tags = normalizeReviewTags(input.structuredTags ?? row.structuredTags);
  if (title) data.title = title;
  if (rawTranscript) data.rawTranscript = rawTranscript;
  if (summary) data.structuredSummary = summary;
  if (nextStep) data.structuredNextStep = nextStep;
  if (sentiment) data.structuredSentiment = sentiment;
  data.structuredTags = tags;
  data.structuredData = structuredData as Prisma.InputJsonValue;
  if (reviewNotes) data.reviewNotes = reviewNotes;
  if (rejectedReason) data.rejectedReason = rejectedReason;
  if (decision === 'approve' && !summary) {
    throw new Error('Approving a voice note requires a reviewed summary.');
  }
  return data;
}

function buildReviewedStructuredData(row: VoiceNoteRow, input: ReviewMobileVoiceNoteRequest): MobileVoiceNoteStructuredData {
  const existing = isStructuredData(row.structuredData) ? row.structuredData : undefined;
  const rawText = normalizeTranscript(input.rawTranscript) ?? row.rawTranscript ?? existing?.rawText ?? '';
  const summary = normalizeReviewText(input.structuredSummary ?? row.structuredSummary ?? existing?.summary, 800)
    ?? summarizeForReview(rawText);
  return {
    summary,
    rawText,
    sentiment: normalizeSentiment(input.structuredSentiment ?? row.structuredSentiment ?? existing?.sentiment) ?? 'neutral',
    tags: normalizeReviewTags(input.structuredTags ?? row.structuredTags ?? existing?.tags),
    confidence: existing?.confidence ?? 'medium',
    ...(normalizeReviewText(input.structuredNextStep ?? row.structuredNextStep ?? existing?.nextStep, 500)
      ? { nextStep: normalizeReviewText(input.structuredNextStep ?? row.structuredNextStep ?? existing?.nextStep, 500) as string }
      : {}),
    ...(normalizeReviewText(input.followUpDate ?? existing?.followUpDate, 80)
      ? { followUpDate: normalizeReviewText(input.followUpDate ?? existing?.followUpDate, 80) as string }
      : {}),
    ...(existing?.entities ? { entities: existing.entities } : {}),
  };
}

function inferWritebackTarget(row: VoiceNoteRow) {
  if (row.accountId) return 'account';
  if (row.leadId) return 'lead';
  if (row.trainingSessionId) return 'training_session';
  if (row.consignmentSiteId) return 'consignment_site';
  return undefined;
}

type ApprovedVoiceNoteWriteback = {
  activityTarget?: string;
  writebackTarget?: string;
  createdEntityType?: string;
  createdEntityId?: string;
  createdEntityTitle?: string;
};

async function applyApprovedVoiceNoteWriteback(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  row: VoiceNoteRow,
  input: ReviewMobileVoiceNoteRequest,
  action: MobileVoiceNoteReviewActionKey,
  reviewedAt: Date,
): Promise<ApprovedVoiceNoteWriteback> {
  if (action === 'activity_only') {
    const activityTarget = inferWritebackTarget(row);
    return activityTarget ? { activityTarget, writebackTarget: activityTarget } : {};
  }

  if (action === 'create_training_follow_up') {
    return createTrainingFollowUpFromVoiceNote(tx, actor, row, input);
  }

  if (action === 'create_consignment_work_item') {
    return createConsignmentWorkItemFromVoiceNote(tx, actor, row, input, reviewedAt);
  }

  throw new Error(`Unsupported voice note review action: ${action}`);
}

async function createTrainingFollowUpFromVoiceNote(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  row: VoiceNoteRow,
  input: ReviewMobileVoiceNoteRequest,
): Promise<ApprovedVoiceNoteWriteback> {
  assertActionAccess(actor.role, 'training.schedule');
  if (!row.trainingSessionId) {
    throw new Error('Training follow-up can only be created for a training session voice note.');
  }

  const sessionScope = buildTrainingSessionRecordScope(actor);
  const session = await tx.trainingSession.findFirst({
    where: {
      AND: [
        ...(sessionScope ? [sessionScope] : []),
        { id: row.trainingSessionId },
      ],
    },
    select: { id: true, accountId: true },
  });
  if (!session) {
    throw new Error('Training session is not available for follow-up creation.');
  }

  await assertFollowUpOwnerIsActive(tx, input.followUpOwnerUserId);

  const title = buildFollowUpTitle(input, row);
  const description = buildFollowUpDescription(input, row, 'Training follow-up created from an approved mobile field note.');
  const dueAt = parseFollowUpDueAt(input.followUpDueAt);
  const task = await tx.trainingFollowUpTask.create({
    data: {
      sessionId: session.id,
      accountId: session.accountId,
      createdByUserId: actor.userId,
      title,
      ...(description ? { description } : {}),
      ...(dueAt ? { dueAt } : {}),
      ...(input.followUpOwnerUserId ? { ownerUserId: input.followUpOwnerUserId } : {}),
    },
  });

  await tx.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.CREATE,
      entityType: 'TRAINING_FOLLOW_UP_TASK',
      entityId: task.id,
      afterData: {
        id: task.id,
        sessionId: session.id,
        accountId: session.accountId,
        title: task.title,
        dueAt: task.dueAt?.toISOString(),
        ownerUserId: task.ownerUserId,
      },
      metadata: {
        module: 'field_activity',
        operation: 'training_follow_up_created_from_voice_note',
        sourceVoiceNoteId: row.id,
        acumaticaBoundary: 'not_an_acumatica_writeback',
      },
    }),
  });

  return {
    activityTarget: 'training_session',
    writebackTarget: `training_follow_up_task:${task.id}`,
    createdEntityType: 'TRAINING_FOLLOW_UP_TASK',
    createdEntityId: task.id,
    createdEntityTitle: task.title,
  };
}

async function createConsignmentWorkItemFromVoiceNote(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  row: VoiceNoteRow,
  input: ReviewMobileVoiceNoteRequest,
  reviewedAt: Date,
): Promise<ApprovedVoiceNoteWriteback> {
  assertActionAccess(actor.role, 'consignment.audit');
  if (!row.consignmentSiteId) {
    throw new Error('Consignment work item can only be created for a consignment site voice note.');
  }

  const site = await tx.consignmentSite.findFirst({
    where: {
      AND: [
        { id: row.consignmentSiteId },
        buildConsignmentSiteScopeWhere(actor),
      ],
    },
    select: { id: true, ownerTmUserId: true },
  });
  if (!site) {
    throw new Error('Consignment site is not available for work-item creation.');
  }

  await assertFollowUpOwnerIsActive(tx, input.followUpOwnerUserId);

  const title = buildFollowUpTitle(input, row);
  const notes = buildFollowUpDescription(input, row, 'Consignment work item created from an approved mobile field note.');
  const dueAt = parseFollowUpDueAt(input.followUpDueAt);
  const priority = normalizeFollowUpPriority(input.followUpPriority);
  const assignedToUserId = input.followUpOwnerUserId ?? site.ownerTmUserId ?? undefined;
  const workItem = await tx.consignmentWorkItem.create({
    data: {
      siteId: site.id,
      type: ConsignmentWorkItemType.FIELD_NOTE_FOLLOW_UP,
      status: ConsignmentWorkItemStatus.OPEN,
      priority,
      title,
      ...(assignedToUserId ? { assignedToUserId } : {}),
      ...(dueAt ? { dueAt } : {}),
      ...(notes ? { notes } : {}),
    },
  });

  await tx.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.CREATE,
      entityType: 'CONSIGNMENT_WORK_ITEM',
      entityId: workItem.id,
      afterData: {
        id: workItem.id,
        siteId: site.id,
        type: workItem.type,
        title: workItem.title,
        dueAt: workItem.dueAt?.toISOString(),
        priority: workItem.priority,
        assignedToUserId: workItem.assignedToUserId,
      },
      metadata: {
        module: 'field_activity',
        operation: 'consignment_work_item_created_from_voice_note',
        sourceVoiceNoteId: row.id,
        reviewedAt: reviewedAt.toISOString(),
        acumaticaBoundary: 'manual_pulse_work_item_only',
      },
    }),
  });

  return {
    activityTarget: 'consignment_site',
    writebackTarget: `consignment_work_item:${workItem.id}`,
    createdEntityType: 'CONSIGNMENT_WORK_ITEM',
    createdEntityId: workItem.id,
    createdEntityTitle: workItem.title,
  };
}

async function assertFollowUpOwnerIsActive(tx: Prisma.TransactionClient, ownerUserId: string | undefined) {
  if (!ownerUserId) return;
  const owner = await tx.user.findUnique({
    where: { id: ownerUserId },
    select: { id: true, isActive: true },
  });
  if (!owner || !owner.isActive) {
    throw new Error('Follow-up owner was not found.');
  }
}

function buildFollowUpTitle(input: ReviewMobileVoiceNoteRequest, row: VoiceNoteRow) {
  return normalizeReviewText(input.followUpTitle ?? input.structuredNextStep ?? row.structuredNextStep ?? row.title, 180)
    ?? DEFAULT_FOLLOW_UP_TITLE;
}

function buildFollowUpDescription(input: ReviewMobileVoiceNoteRequest, row: VoiceNoteRow, prefix: string) {
  const description = normalizeReviewText(input.followUpDescription, 1000);
  if (description) return description;
  const summary = normalizeReviewText(input.structuredSummary ?? row.structuredSummary ?? row.rawTranscript, 800);
  const nextStep = normalizeReviewText(input.structuredNextStep ?? row.structuredNextStep, 500);
  return [
    prefix,
    summary ? `Summary: ${summary}` : undefined,
    nextStep ? `Next step: ${nextStep}` : undefined,
    `Source voice note: ${row.id}`,
  ].filter(Boolean).join('\n');
}

function parseFollowUpDueAt(value: string | undefined) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Follow-up due date must be a valid ISO date.');
  }
  return parsed;
}

function normalizeFollowUpPriority(value: MobileVoiceNoteFollowUpPriorityKey | undefined) {
  return value ?? 'normal';
}

function normalizeReviewWritebackAction(value: ReviewMobileVoiceNoteRequest['writebackAction']): MobileVoiceNoteReviewActionKey {
  if (!value) return 'activity_only';
  if (value === 'activity_only' || value === 'create_training_follow_up' || value === 'create_consignment_work_item') return value;
  throw new Error(`Unsupported voice note review action: ${value}`);
}

async function writeApprovedVoiceNoteActivity(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  row: VoiceNoteRow,
  target: string,
  writeback?: ApprovedVoiceNoteWriteback,
) {
  const payload = buildApprovedActivityPayload(row);
  const targetEntity = targetEntityForVoiceNote(row, target);
  if (!targetEntity) return;
  await tx.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: targetEntity.entityType,
      entityId: targetEntity.entityId,
      afterData: payload,
      metadata: {
        module: 'field_activity',
        operation: 'mobile_voice_note_approved',
        workflowAction: 'mobile_voice_note_approved',
        sourceVoiceNoteId: row.id,
        capturedByUserId: row.createdByUserId,
        reviewedByUserId: actor.userId,
        createdEntityType: writeback?.createdEntityType,
        createdEntityId: writeback?.createdEntityId,
        acumaticaBoundary: 'not_an_acumatica_writeback',
      },
    }),
  });
}

function targetEntityForVoiceNote(row: VoiceNoteRow, target: string) {
  if (target === 'account' && row.accountId) return { entityType: 'ACCOUNT', entityId: row.accountId };
  if (target === 'lead' && row.leadId) return { entityType: 'LEAD', entityId: row.leadId };
  if (target === 'training_session' && row.trainingSessionId) return { entityType: 'TRAINING_SESSION', entityId: row.trainingSessionId };
  if (target === 'consignment_site' && row.consignmentSiteId) return { entityType: 'CONSIGNMENT_SITE', entityId: row.consignmentSiteId };
  return undefined;
}

function buildApprovedActivityPayload(row: VoiceNoteRow) {
  return {
    voiceNoteId: row.id,
    title: row.title,
    summary: row.structuredSummary,
    nextStep: row.structuredNextStep,
    sentiment: row.structuredSentiment,
    tags: row.structuredTags,
    rawTranscript: row.rawTranscript,
    recordedAt: row.recordedAt.toISOString(),
    capturedByName: row.createdBy?.displayName,
    reviewedByName: row.reviewedBy?.displayName,
  };
}

function isStructuredData(value: Prisma.JsonValue | null): value is MobileVoiceNoteStructuredData {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && typeof (value as Record<string, unknown>).summary === 'string');
}

function normalizeReviewText(value: string | undefined | null, maxLength: number) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function normalizeReviewTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === 'string' ? item.trim().toLowerCase() : '')
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeSentiment(value: unknown): MobileVoiceNoteStructuredData['sentiment'] | undefined {
  return value === 'positive' || value === 'neutral' || value === 'concern' || value === 'urgent' ? value : undefined;
}

function summarizeForReview(rawText: string) {
  return rawText.replace(/\s+/g, ' ').trim().slice(0, 220) || 'Reviewed field note.';
}

function normalizeSearch(value: string | undefined) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 120) : undefined;
}

function compactString<Key extends string>(key: Key, value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? { [key]: normalized } as Record<Key, string> : {};
}

function compactEnumFilter(contextType: MobileVoiceNoteContextTypeKey | undefined) {
  return contextType ? { contextType: toPrismaContext(contextType) } : {};
}

function toPrismaContext(contextType: MobileVoiceNoteContextTypeKey) {
  const mapped = contextToPrisma[contextType];
  if (!mapped) throw new Error(`Unsupported voice note context type: ${contextType}`);
  return mapped;
}

function toPrismaStatus(status: MobileVoiceNoteProcessingStatusKey) {
  const mapped = statusToPrisma[status];
  if (!mapped) throw new Error(`Unsupported voice note status: ${status}`);
  return mapped;
}

function compactProcessingStatusFilter(status: MobileVoiceNoteProcessingStatusKey | undefined) {
  return status ? { processingStatus: toPrismaStatus(status) } : {};
}

function compactReviewStatusFilter(status: MobileVoiceNoteReviewStatusKey | undefined) {
  return status ? { reviewStatus: toPrismaReviewStatus(status) } : {};
}

function toPrismaReviewStatus(status: MobileVoiceNoteReviewStatusKey) {
  const mapped = reviewStatusToPrisma[status];
  if (!mapped) throw new Error(`Unsupported voice note review status: ${status}`);
  return mapped;
}
