import { createHash } from 'node:crypto';
import { assertActionAccess } from '@pulse/auth';
import {
  AuditAction,
  GroupAxisSelection,
  GroupRosterImportKind,
  GroupRosterImportRowDecision,
  GroupRosterImportRowStatus,
  GroupRosterImportRunStatus,
  GroupRosterMatchEntityType,
  LeadStage,
  Prisma,
  prisma,
} from '@pulse/db';
import type {
  CommitGroupRosterImportRunRequest,
  GroupRosterImportCommitResponse,
  GroupRosterImportFilePreviewRequest,
  GroupRosterImportFilePreviewResponse,
  GroupRosterImportReviewRow,
  GroupRosterImportRowActionKey,
  GroupRosterImportRunDetail,
  GroupRosterMatchCandidate,
  ReviewGroupRosterImportRequest,
  ReviewGroupRosterImportResponse,
} from '@pulse/contracts';
import type { AuthenticatedActor } from '../auth/types.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import { JSON_SIZE_LIMITS, toBoundedJsonValue } from '../../utils/json.js';
import { deriveGroupClassification } from './group-classification.js';
import { mapGroupRosterImportFile, previewGroupRosterImportFile, type GroupRosterImportMappedRow } from './roster-file-ingest.js';

type GroupKindKey = 'affinity' | 'ownership';

type RosterTargetGroup = {
  kind: GroupKindKey;
  id: string;
  code: string;
  name: string;
};

type GroupRosterImportRunWithRows = Prisma.GroupRosterImportRunGetPayload<{
  include: typeof GROUP_ROSTER_IMPORT_RUN_INCLUDE;
}>;

type GroupRosterReviewComputationRow = {
  rowNumber: number;
  status: GroupRosterImportRowStatus;
  detail: string;
  sourceValues: Record<string, string>;
  candidates: GroupRosterMatchCandidate[];
  selectedEntityId?: string;
};

const GROUP_ROSTER_IMPORT_RUN_INCLUDE = {
  rows: {
    orderBy: {
      rowNumber: 'asc',
    },
  },
  affinityGroup: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  ownershipGroup: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
} satisfies Prisma.GroupRosterImportRunInclude;

const LEAD_MATCH_INCLUDE = {
  convertedAccount: {
    select: {
      id: true,
    },
  },
} satisfies Prisma.LeadInclude;

const ACCOUNT_MATCH_INCLUDE = {
  contacts: {
    where: {
      isActive: true,
    },
    orderBy: [
      { isPrimary: 'desc' },
      { createdAt: 'asc' },
    ],
    take: 1,
  },
  sourceLead: {
    select: {
      id: true,
    },
  },
} satisfies Prisma.AccountInclude;

export async function previewGroupRosterImport(
  actor: AuthenticatedActor,
  input: GroupRosterImportFilePreviewRequest,
): Promise<GroupRosterImportFilePreviewResponse> {
  assertActionAccess(actor.role, 'reference.manage');

  await resolveRosterTargetGroup(prisma, input.groupKind, input.groupId);
  return previewGroupRosterImportFile(input);
}

export async function reviewGroupRosterImport(
  actor: AuthenticatedActor,
  input: ReviewGroupRosterImportRequest,
): Promise<ReviewGroupRosterImportResponse> {
  assertActionAccess(actor.role, 'reference.manage');

  const targetGroup = await resolveRosterTargetGroup(prisma, input.groupKind, input.groupId);
  const mapped = mapGroupRosterImportFile(input);
  const reviewRows: GroupRosterReviewComputationRow[] = [];
  let readyRowCount = 0;
  const withinFileSignals = new Map<string, GroupRosterMatchCandidate[]>();

  for (const [index, row] of mapped.rows.entries()) {
    const rowNumber = mapped.rowNumbers[index] ?? index + 2;
    const sourceValues = mapped.sourceRows[index]?.values ?? {};

    try {
      const normalized = normalizeRosterRow(row);
      const candidates = [
        ...buildWithinFileDuplicateCandidates(withinFileSignals, normalized),
        ...(await findPersistedRosterCandidates(prisma, normalized, targetGroup)),
      ];
      registerWithinFileDuplicateSignals(withinFileSignals, rowNumber, normalized, sourceValues);

      const persistedCandidates = candidates.filter((candidate) => candidate.entityType !== 'import_row');
      const importRowCandidates = candidates.filter((candidate) => candidate.entityType === 'import_row');
      const conflictCandidate = persistedCandidates.find((candidate) => candidate.conflictReason);

      if (persistedCandidates.length === 1 && importRowCandidates.length === 0 && !conflictCandidate) {
        readyRowCount += 1;
        reviewRows.push({
          rowNumber,
          status: GroupRosterImportRowStatus.READY,
          detail: `Matched to existing ${persistedCandidates[0]?.entityType === 'account' ? 'customer account' : 'lead'} ${persistedCandidates[0]?.title}.`,
          sourceValues,
          candidates,
          ...(persistedCandidates[0]?.entityId ? { selectedEntityId: persistedCandidates[0].entityId } : {}),
        });
        continue;
      }

      reviewRows.push({
        rowNumber,
        status: persistedCandidates.length === 0 && importRowCandidates.length === 0
          ? GroupRosterImportRowStatus.REQUIRES_REVIEW
          : GroupRosterImportRowStatus.REQUIRES_REVIEW,
        detail: buildReviewRowDetail(persistedCandidates, importRowCandidates, conflictCandidate),
        sourceValues,
        candidates,
      });
    } catch (error) {
      reviewRows.push({
        rowNumber,
        status: GroupRosterImportRowStatus.INVALID,
        detail: error instanceof Error ? error.message : String(error),
        sourceValues,
        candidates: [],
      });
    }
  }

  const batchName = optionalTrimmed(input.batchName);
  const sourceLabel = optionalTrimmed(input.sourceLabel);
  const sourceVersion = optionalTrimmed(input.sourceVersion);
  const effectiveDate = parseOptionalDate(input.effectiveDate, 'effectiveDate');

  const run: GroupRosterImportRunWithRows = await prisma.groupRosterImportRun.create({
    data: {
      ...(actor.userId ? { createdByUserId: actor.userId } : {}),
      groupKind: toGroupRosterImportKindEnum(targetGroup.kind),
      ...(targetGroup.kind === 'affinity' ? { affinityGroupId: targetGroup.id } : { ownershipGroupId: targetGroup.id }),
      fileName: mapped.fileName,
      fileFormat: mapped.format,
      fileDigest: buildRosterImportFileDigest(input.fileName, input.fileContentBase64, input.sheetName, targetGroup),
      sheetName: mapped.sheetName,
      ...(batchName ? { batchName } : {}),
      ...(sourceLabel ? { sourceLabel } : {}),
      ...(sourceVersion ? { sourceVersion } : {}),
      ...(effectiveDate ? { effectiveDate } : {}),
      mappings: toBoundedJsonValue(input.mappings, {
        field: 'groupRosterImportRun.mappings',
        maxBytes: JSON_SIZE_LIMITS.leadImportRunMappingsBytes,
      }),
      totalRows: mapped.totalRows,
      mappedRows: mapped.rows.length,
      readyRowCount,
      attentionRowCount: reviewRows.filter((row) => row.status !== GroupRosterImportRowStatus.READY).length,
      rows: {
        create: reviewRows.map((row) => ({
          rowNumber: row.rowNumber,
          status: row.status,
          detail: row.detail,
          ...(Object.keys(row.sourceValues).length > 0
            ? {
                sourceValues: toBoundedJsonValue(row.sourceValues, {
                  field: `groupRosterImportRunRow.sourceValues[row ${row.rowNumber}]`,
                  maxBytes: JSON_SIZE_LIMITS.leadImportRunRowSourceValuesBytes,
                }),
              }
            : {}),
          ...(row.candidates.length > 0
            ? {
                matchedCandidates: toBoundedJsonValue(row.candidates, {
                  field: `groupRosterImportRunRow.matchedCandidates[row ${row.rowNumber}]`,
                  maxBytes: JSON_SIZE_LIMITS.leadImportRunRowCandidatesBytes,
                }),
              }
            : {}),
          ...(row.selectedEntityId
            ? {
                selectedEntityId: row.selectedEntityId,
                selectedEntityType:
                  toSelectedEntityTypeEnum(row.candidates.find((candidate) => candidate.entityId === row.selectedEntityId)?.entityType) ?? null,
              }
            : {}),
        })),
      },
    },
    include: GROUP_ROSTER_IMPORT_RUN_INCLUDE,
  });

  return toGroupRosterImportRunDetail(run);
}

export async function getGroupRosterImportRun(
  actor: AuthenticatedActor,
  runId: string,
): Promise<GroupRosterImportRunDetail> {
  assertActionAccess(actor.role, 'reference.manage');

  const run = await prisma.groupRosterImportRun.findUnique({
    where: { id: runId },
    include: GROUP_ROSTER_IMPORT_RUN_INCLUDE,
  });
  if (!run) {
    throw new Error('Group roster import run not found');
  }

  return toGroupRosterImportRunDetail(run);
}

export async function commitGroupRosterImportRun(
  actor: AuthenticatedActor,
  runId: string,
  input: CommitGroupRosterImportRunRequest,
): Promise<GroupRosterImportCommitResponse> {
  assertActionAccess(actor.role, 'reference.manage');

  const finalizedRun: GroupRosterImportRunWithRows = await prisma.$transaction(async (tx) => {
    const run = await tx.groupRosterImportRun.findUnique({
      where: { id: runId },
      include: GROUP_ROSTER_IMPORT_RUN_INCLUDE,
    });
    if (!run) {
      throw new Error('Group roster import run not found');
    }

    if (run.status === GroupRosterImportRunStatus.APPLIED || run.status === GroupRosterImportRunStatus.APPLIED_WITH_ERRORS) {
      return run;
    }

    const targetGroup = extractRunTargetGroup(run);
    const incomingDecisions = new Map<number, NonNullable<CommitGroupRosterImportRunRequest['rowDecisions']>[number]>(
      (input.rowDecisions ?? []).map((decision) => [decision.rowNumber, decision]),
    );

    for (const row of run.rows) {
      const incomingDecision = incomingDecisions.get(row.rowNumber);
      if (!incomingDecision) {
        continue;
      }

      await tx.groupRosterImportRunRow.update({
        where: { id: row.id },
        data: {
          decision: toGroupRosterImportRowDecisionEnum(incomingDecision.action),
          selectedEntityId: incomingDecision.targetEntityId ?? row.selectedEntityId ?? null,
          ...(incomingDecision.targetEntityId
            ? {
                selectedEntityType:
                  toSelectedEntityTypeEnum(
                    parseGroupRosterMatchCandidates(row.matchedCandidates).find((candidate) => candidate.entityId === incomingDecision.targetEntityId)?.entityType,
                  ) ?? null,
              }
            : {}),
        },
      });
    }

    const refreshedRun = await tx.groupRosterImportRun.findUniqueOrThrow({
      where: { id: runId },
      include: GROUP_ROSTER_IMPORT_RUN_INCLUDE,
    });

    validateGroupRosterRunDecisions(refreshedRun.rows);

    let appliedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const row of refreshedRun.rows) {
      if (row.status === GroupRosterImportRowStatus.APPLIED || row.status === GroupRosterImportRowStatus.SKIPPED) {
        if (row.status === GroupRosterImportRowStatus.APPLIED) {
          appliedCount += 1;
        } else {
          skippedCount += 1;
        }
        continue;
      }

      if (row.status === GroupRosterImportRowStatus.INVALID || row.status === GroupRosterImportRowStatus.FAILED) {
        errorCount += 1;
        continue;
      }

      const decisionKey = toGroupRosterImportRowActionKey(row.decision);
      if (row.status === GroupRosterImportRowStatus.REQUIRES_REVIEW && decisionKey === 'skip') {
        skippedCount += 1;
        await tx.groupRosterImportRunRow.update({
          where: { id: row.id },
          data: {
            status: GroupRosterImportRowStatus.SKIPPED,
            detail: 'Row skipped by steward decision during roster review.',
          },
        });
        continue;
      }

      try {
        const applyResult = await applyRosterRowToEntityFamily(tx, actor, targetGroup, row);
        appliedCount += 1;
        await tx.groupRosterImportRunRow.update({
          where: { id: row.id },
          data: {
            status: GroupRosterImportRowStatus.APPLIED,
            appliedLeadId: applyResult.appliedLeadId ?? null,
            appliedAccountId: applyResult.appliedAccountId ?? null,
            appliedAt: new Date(),
            detail: applyResult.detail,
          },
        });
      } catch (error) {
        errorCount += 1;
        await tx.groupRosterImportRunRow.update({
          where: { id: row.id },
          data: {
            status: GroupRosterImportRowStatus.FAILED,
            detail: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    return tx.groupRosterImportRun.update({
      where: { id: runId },
      data: {
        status: errorCount > 0 ? GroupRosterImportRunStatus.APPLIED_WITH_ERRORS : GroupRosterImportRunStatus.APPLIED,
        appliedCount,
        skippedCount,
        errorCount,
        appliedAt: new Date(),
      },
      include: GROUP_ROSTER_IMPORT_RUN_INCLUDE,
    });
  });

  return buildGroupRosterImportCommitResponse(finalizedRun);
}

function buildReviewRowDetail(
  persistedCandidates: GroupRosterMatchCandidate[],
  importRowCandidates: GroupRosterMatchCandidate[],
  conflictCandidate?: GroupRosterMatchCandidate,
) {
  if (conflictCandidate?.conflictReason) {
    return conflictCandidate.conflictReason;
  }

  if (persistedCandidates.length === 0 && importRowCandidates.length > 0) {
    return `Potential duplicate found against other rows in this roster file (${importRowCandidates.length} candidate${importRowCandidates.length === 1 ? '' : 's'}).`;
  }
  if (persistedCandidates.length === 0) {
    return 'No existing lead or customer account match was found. Review this row before applying roster membership.';
  }
  if (importRowCandidates.length > 0 && persistedCandidates.length > 0) {
    return `Potential duplicate found across existing records and other rows in this roster file (${persistedCandidates.length + importRowCandidates.length} candidate${persistedCandidates.length + importRowCandidates.length === 1 ? '' : 's'}).`;
  }

  return `Multiple existing match candidates were found (${persistedCandidates.length} candidates). Select which record should receive the roster membership update.`;
}

async function findPersistedRosterCandidates(
  tx: Prisma.TransactionClient,
  input: ReturnType<typeof normalizeRosterRow>,
  targetGroup: RosterTargetGroup,
): Promise<GroupRosterMatchCandidate[]> {
  const [leadMatches, accountMatches] = await Promise.all([
    findLeadRosterCandidates(tx, input, targetGroup),
    findAccountRosterCandidates(tx, input, targetGroup),
  ]);

  return [...leadMatches, ...accountMatches]
    .sort((left, right) => confidenceRank(right.confidence) - confidenceRank(left.confidence));
}

async function findLeadRosterCandidates(
  tx: Prisma.TransactionClient,
  input: ReturnType<typeof normalizeRosterRow>,
  targetGroup: RosterTargetGroup,
): Promise<GroupRosterMatchCandidate[]> {
  const signals = buildLeadRosterMatchSignals(input);
  if (signals.length === 0) {
    return [];
  }

  const leads = await tx.lead.findMany({
    where: {
      AND: [
        {
          stage: {
            not: LeadStage.CUSTOMER_ACTIVE,
          },
        },
        {
          OR: signals,
        },
      ],
    },
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 5,
    include: LEAD_MATCH_INCLUDE,
  });

  return leads.map((lead) => toLeadRosterCandidate(lead, input, targetGroup));
}

async function findAccountRosterCandidates(
  tx: Prisma.TransactionClient,
  input: ReturnType<typeof normalizeRosterRow>,
  targetGroup: RosterTargetGroup,
): Promise<GroupRosterMatchCandidate[]> {
  const signals = buildAccountRosterMatchSignals(input);
  if (signals.length === 0) {
    return [];
  }

  const accounts = await tx.account.findMany({
    where: {
      OR: signals,
    },
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 5,
    include: ACCOUNT_MATCH_INCLUDE,
  });

  return accounts.map((account) => toAccountRosterCandidate(account, input, targetGroup));
}

function buildLeadRosterMatchSignals(input: ReturnType<typeof normalizeRosterRow>): Prisma.LeadWhereInput[] {
  const signals: Prisma.LeadWhereInput[] = [];

  if (input.email) {
    signals.push({
      email: {
        equals: input.email,
        mode: Prisma.QueryMode.insensitive,
      },
    });
  }
  if (input.phone) {
    signals.push({ phone: input.phone });
  }
  if (input.companyName && input.state) {
    signals.push({
      AND: [
        {
          companyName: {
            equals: input.companyName,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          state: input.state,
        },
      ],
    });
  } else if (input.companyName) {
    signals.push({
      companyName: {
        equals: input.companyName,
        mode: Prisma.QueryMode.insensitive,
      },
    });
  }

  return signals;
}

function buildAccountRosterMatchSignals(input: ReturnType<typeof normalizeRosterRow>): Prisma.AccountWhereInput[] {
  const signals: Prisma.AccountWhereInput[] = [];

  if (input.companyName) {
    signals.push({
      displayName: {
        equals: input.companyName,
        mode: Prisma.QueryMode.insensitive,
      },
    });
    signals.push({
      legalName: {
        equals: input.companyName,
        mode: Prisma.QueryMode.insensitive,
      },
    });
  }
  if (input.email) {
    signals.push({
      contacts: {
        some: {
          email: {
            equals: input.email,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      },
    });
  }
  if (input.phone) {
    signals.push({
      contacts: {
        some: {
          OR: [
            { phone: input.phone },
            { mobilePhone: input.phone },
          ],
        },
      },
    });
  }

  return signals;
}

function toLeadRosterCandidate(
  lead: Prisma.LeadGetPayload<{ include: typeof LEAD_MATCH_INCLUDE }>,
  input: ReturnType<typeof normalizeRosterRow>,
  targetGroup: RosterTargetGroup,
): GroupRosterMatchCandidate {
  const matchedSignals = computeLeadMatchedSignals(lead, input);
  const conflictReason = buildGroupConflictReason({
    entityLabel: `Lead ${lead.companyName}`,
    existingSelection: targetGroup.kind === 'affinity' ? lead.affinityGroupSelection : lead.ownershipGroupSelection,
    existingGroupId: targetGroup.kind === 'affinity' ? lead.affinityGroupId : lead.ownershipGroupId,
    targetGroup,
  });

  return {
    entityType: 'lead',
    entityId: lead.id,
    title: lead.companyName,
    subtitle: `${lead.contactDisplayName} · ${lead.state ?? 'No state'}${lead.convertedAccount ? ' · linked account' : ''}`,
    detail: [lead.email, lead.phone].filter(Boolean).join(' · '),
    confidence: deriveConfidence(matchedSignals),
    matchedSignals,
    ...(conflictReason ? { conflictReason } : {}),
  };
}

function toAccountRosterCandidate(
  account: Prisma.AccountGetPayload<{ include: typeof ACCOUNT_MATCH_INCLUDE }>,
  input: ReturnType<typeof normalizeRosterRow>,
  targetGroup: RosterTargetGroup,
): GroupRosterMatchCandidate {
  const primaryContact = account.contacts[0];
  const matchedSignals = computeAccountMatchedSignals(account, input);
  const conflictReason = buildGroupConflictReason({
    entityLabel: `Account ${account.displayName}`,
    existingSelection: targetGroup.kind === 'affinity' ? account.affinityGroupSelection : account.ownershipGroupSelection,
    existingGroupId: targetGroup.kind === 'affinity' ? account.affinityGroupId : account.ownershipGroupId,
    targetGroup,
  });

  return {
    entityType: 'account',
    entityId: account.id,
    title: account.displayName,
    subtitle: account.accountNumber ? `Account ${account.accountNumber}` : 'Existing customer account',
    detail: [
      account.legalName,
      primaryContact ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim() : null,
      primaryContact?.email ?? null,
      primaryContact?.phone ?? primaryContact?.mobilePhone ?? null,
    ].filter(Boolean).join(' · '),
    confidence: deriveConfidence(matchedSignals),
    matchedSignals,
    ...(conflictReason ? { conflictReason } : {}),
  };
}

function computeLeadMatchedSignals(
  lead: Prisma.LeadGetPayload<{ include: typeof LEAD_MATCH_INCLUDE }>,
  input: ReturnType<typeof normalizeRosterRow>,
) {
  const matchedSignals: string[] = [];

  if (input.email && lead.email?.toLowerCase() === input.email) {
    matchedSignals.push('email');
  }
  if (input.phone && normalizePhone(lead.phone) === input.phone) {
    matchedSignals.push('phone');
  }
  if (input.companyName && lead.companyName.toLowerCase() === input.companyName) {
    matchedSignals.push('company_name');
    if (input.state && (lead.state ?? '').toUpperCase() === input.state) {
      matchedSignals.push('state');
    }
  }

  return matchedSignals;
}

function computeAccountMatchedSignals(
  account: Prisma.AccountGetPayload<{ include: typeof ACCOUNT_MATCH_INCLUDE }>,
  input: ReturnType<typeof normalizeRosterRow>,
) {
  const matchedSignals: string[] = [];
  const primaryContact = account.contacts[0];

  if (input.email && primaryContact?.email?.toLowerCase() === input.email) {
    matchedSignals.push('email');
  }
  if (input.phone) {
    const phone = normalizePhone(primaryContact?.phone ?? undefined);
    const mobilePhone = normalizePhone(primaryContact?.mobilePhone ?? undefined);
    if (phone === input.phone || mobilePhone === input.phone) {
      matchedSignals.push('phone');
    }
  }
  if (input.companyName) {
    if (account.displayName.toLowerCase() === input.companyName || account.legalName?.toLowerCase() === input.companyName) {
      matchedSignals.push('company_name');
    }
  }

  return matchedSignals;
}

function buildGroupConflictReason(input: {
  entityLabel: string;
  existingSelection: GroupAxisSelection;
  existingGroupId: string | null;
  targetGroup: RosterTargetGroup;
}) {
  if (input.existingSelection !== GroupAxisSelection.GROUP || !input.existingGroupId || input.existingGroupId === input.targetGroup.id) {
    return undefined;
  }

  return `${input.entityLabel} already belongs to ${input.targetGroup.kind} group another governed group. Steward review is required before overwriting membership.`;
}

function deriveConfidence(matchedSignals: string[]): 'high' | 'medium' | 'low' {
  if (matchedSignals.includes('email') || matchedSignals.includes('phone')) {
    return 'high';
  }
  if (matchedSignals.includes('company_name') && matchedSignals.includes('state')) {
    return 'medium';
  }
  return 'low';
}

function confidenceRank(value: 'high' | 'medium' | 'low') {
  switch (value) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
  }
}

function normalizeRosterRow(row: GroupRosterImportMappedRow) {
  const companyName = optionalTrimmed(row.companyName)?.toLowerCase();
  const contactDisplayName = optionalTrimmed(row.contactDisplayName);
  const email = optionalTrimmed(row.email)?.toLowerCase();
  const phone = normalizePhone(row.phone);
  const state = normalizeState(row.state);
  const city = optionalTrimmed(row.city)?.toLowerCase();

  if (!companyName && !email && !phone) {
    throw new Error('Roster row must include at least a company name, email, or phone for matching.');
  }

  return {
    companyName,
    contactDisplayName,
    email,
    phone,
    state,
    city,
  };
}

function buildWithinFileDuplicateCandidates(
  seenSignals: Map<string, GroupRosterMatchCandidate[]>,
  input: ReturnType<typeof normalizeRosterRow>,
) {
  const candidates = new Map<string, GroupRosterMatchCandidate>();

  for (const signal of buildWithinFileSignalKeys(input)) {
    const signalCandidates = seenSignals.get(signal) ?? [];
    for (const candidate of signalCandidates) {
      candidates.set(candidate.entityId, candidate);
    }
  }

  return [...candidates.values()];
}

function registerWithinFileDuplicateSignals(
  seenSignals: Map<string, GroupRosterMatchCandidate[]>,
  rowNumber: number,
  input: ReturnType<typeof normalizeRosterRow>,
  sourceValues: Record<string, string>,
) {
  const candidate: GroupRosterMatchCandidate = {
    entityType: 'import_row',
    entityId: `import-row:${rowNumber}`,
    title: sourceValues.Company || sourceValues.companyName || input.companyName || `Roster row ${rowNumber}`,
    subtitle: `Roster row #${rowNumber}`,
    detail: [sourceValues.Email || sourceValues.email, sourceValues.Phone || sourceValues.phone, sourceValues.State || sourceValues.state]
      .filter(Boolean)
      .join(' · '),
    confidence: 'low',
    matchedSignals: buildWithinFileSignalKeys(input),
  };

  for (const signal of buildWithinFileSignalKeys(input)) {
    const rows = seenSignals.get(signal) ?? [];
    rows.push(candidate);
    seenSignals.set(signal, rows);
  }
}

function buildWithinFileSignalKeys(input: ReturnType<typeof normalizeRosterRow>) {
  return [
    input.email ? `email:${input.email}` : null,
    input.phone ? `phone:${input.phone}` : null,
    input.companyName && input.state ? `company:${input.companyName}:state:${input.state}` : null,
    input.companyName && !input.state ? `company:${input.companyName}` : null,
  ].filter((value): value is string => Boolean(value));
}

function validateGroupRosterRunDecisions(rows: GroupRosterImportRunWithRows['rows']) {
  for (const row of rows) {
    if (row.status !== GroupRosterImportRowStatus.REQUIRES_REVIEW) {
      continue;
    }

    const action = toGroupRosterImportRowActionKey(row.decision);
    if (!action) {
      throw new Error(`Row ${row.rowNumber} still requires a steward decision before the roster import can continue.`);
    }

    if (action === 'skip') {
      continue;
    }

    const persistedCandidates = parseGroupRosterMatchCandidates(row.matchedCandidates)
      .filter((candidate) => candidate.entityType !== 'import_row');
    if (persistedCandidates.length === 0) {
      throw new Error(`Row ${row.rowNumber} cannot apply roster membership without a matched lead or customer account.`);
    }
    if (row.selectedEntityId) {
      const selectedCandidate = persistedCandidates.find((candidate) => candidate.entityId === row.selectedEntityId);
      if (!selectedCandidate) {
        throw new Error(`Row ${row.rowNumber} has an invalid selected roster target.`);
      }
    } else if (persistedCandidates.length > 1) {
      throw new Error(`Row ${row.rowNumber} must choose which existing record should receive the roster membership update.`);
    }
  }
}

async function applyRosterRowToEntityFamily(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  targetGroup: RosterTargetGroup,
  row: GroupRosterImportRunWithRows['rows'][number],
) {
  const selected = resolveSelectedRosterCandidate(row);
  if (!selected) {
    throw new Error(`Row ${row.rowNumber} does not have a selected roster target.`);
  }

  if (selected.entityType === 'lead') {
    const lead = await tx.lead.findUnique({
      where: { id: selected.entityId },
      include: LEAD_MATCH_INCLUDE,
    });
    if (!lead) {
      throw new Error(`Lead not found for roster row ${row.rowNumber}`);
    }

    const updatedLead = await updateLeadRosterMembership(tx, actor, lead, targetGroup, row.runId);
    let appliedAccountId: string | undefined;
    if (lead.convertedAccount?.id) {
      const account = await tx.account.findUnique({
        where: { id: lead.convertedAccount.id },
      });
      if (account) {
        await updateAccountRosterMembership(tx, actor, account, targetGroup, row.runId);
        appliedAccountId = account.id;
      }
    }

    return {
      appliedLeadId: updatedLead.id,
      appliedAccountId,
      detail: appliedAccountId
        ? `Roster membership applied to lead ${updatedLead.companyName} and linked customer account.`
        : `Roster membership applied to lead ${updatedLead.companyName}.`,
    };
  }

  const account = await tx.account.findUnique({
    where: { id: selected.entityId },
  });
  if (!account) {
    throw new Error(`Account not found for roster row ${row.rowNumber}`);
  }

  const updatedAccount = await updateAccountRosterMembership(tx, actor, account, targetGroup, row.runId);
  let appliedLeadId: string | undefined;
  if (account.sourceLeadId) {
    const lead = await tx.lead.findUnique({
      where: { id: account.sourceLeadId },
      include: LEAD_MATCH_INCLUDE,
    });
    if (lead) {
      await updateLeadRosterMembership(tx, actor, lead, targetGroup, row.runId);
      appliedLeadId = lead.id;
    }
  }

  return {
    appliedLeadId,
    appliedAccountId: updatedAccount.id,
    detail: appliedLeadId
      ? `Roster membership applied to customer account ${updatedAccount.displayName} and linked source lead.`
      : `Roster membership applied to customer account ${updatedAccount.displayName}.`,
  };
}

async function updateLeadRosterMembership(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  lead: Prisma.LeadGetPayload<{ include: typeof LEAD_MATCH_INCLUDE }>,
  targetGroup: RosterTargetGroup,
  runId: string,
) {
  const nextAffinitySelection = targetGroup.kind === 'affinity' ? GroupAxisSelection.GROUP : lead.affinityGroupSelection;
  const nextAffinityGroupId = targetGroup.kind === 'affinity' ? targetGroup.id : lead.affinityGroupId;
  const nextOwnershipSelection = targetGroup.kind === 'ownership' ? GroupAxisSelection.GROUP : lead.ownershipGroupSelection;
  const nextOwnershipGroupId = targetGroup.kind === 'ownership' ? targetGroup.id : lead.ownershipGroupId;
  const nextClassification = deriveGroupClassification(nextAffinitySelection, nextOwnershipSelection);

  const updated = await tx.lead.update({
    where: { id: lead.id },
    data: {
      affinityGroupSelection: nextAffinitySelection,
      affinityGroupId: nextAffinityGroupId,
      ownershipGroupSelection: nextOwnershipSelection,
      ownershipGroupId: nextOwnershipGroupId,
      groupClassification: nextClassification,
    },
  });

  await tx.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'LEAD',
      entityId: lead.id,
      beforeData: {
        affinityGroupSelection: lead.affinityGroupSelection,
        affinityGroupId: lead.affinityGroupId,
        ownershipGroupSelection: lead.ownershipGroupSelection,
        ownershipGroupId: lead.ownershipGroupId,
        groupClassification: lead.groupClassification,
      },
      afterData: {
        affinityGroupSelection: updated.affinityGroupSelection,
        affinityGroupId: updated.affinityGroupId,
        ownershipGroupSelection: updated.ownershipGroupSelection,
        ownershipGroupId: updated.ownershipGroupId,
        groupClassification: updated.groupClassification,
      },
      metadata: {
        source: 'group_roster_import',
        runId,
        targetGroupKind: targetGroup.kind,
        targetGroupCode: targetGroup.code,
        targetGroupName: targetGroup.name,
      },
    }),
  });

  return updated;
}

async function updateAccountRosterMembership(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  account: Prisma.AccountGetPayload<{}>,
  targetGroup: RosterTargetGroup,
  runId: string,
) {
  const nextAffinitySelection = targetGroup.kind === 'affinity' ? GroupAxisSelection.GROUP : account.affinityGroupSelection;
  const nextAffinityGroupId = targetGroup.kind === 'affinity' ? targetGroup.id : account.affinityGroupId;
  const nextOwnershipSelection = targetGroup.kind === 'ownership' ? GroupAxisSelection.GROUP : account.ownershipGroupSelection;
  const nextOwnershipGroupId = targetGroup.kind === 'ownership' ? targetGroup.id : account.ownershipGroupId;
  const nextClassification = deriveGroupClassification(nextAffinitySelection, nextOwnershipSelection);

  const updated = await tx.account.update({
    where: { id: account.id },
    data: {
      affinityGroupSelection: nextAffinitySelection,
      affinityGroupId: nextAffinityGroupId,
      ownershipGroupSelection: nextOwnershipSelection,
      ownershipGroupId: nextOwnershipGroupId,
      groupClassification: nextClassification,
    },
  });

  await tx.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'ACCOUNT',
      entityId: account.id,
      beforeData: {
        affinityGroupSelection: account.affinityGroupSelection,
        affinityGroupId: account.affinityGroupId,
        ownershipGroupSelection: account.ownershipGroupSelection,
        ownershipGroupId: account.ownershipGroupId,
        groupClassification: account.groupClassification,
      },
      afterData: {
        affinityGroupSelection: updated.affinityGroupSelection,
        affinityGroupId: updated.affinityGroupId,
        ownershipGroupSelection: updated.ownershipGroupSelection,
        ownershipGroupId: updated.ownershipGroupId,
        groupClassification: updated.groupClassification,
      },
      metadata: {
        source: 'group_roster_import',
        runId,
        targetGroupKind: targetGroup.kind,
        targetGroupCode: targetGroup.code,
        targetGroupName: targetGroup.name,
      },
    }),
  });

  return updated;
}

function resolveSelectedRosterCandidate(row: GroupRosterImportRunWithRows['rows'][number]) {
  const candidates = parseGroupRosterMatchCandidates(row.matchedCandidates)
    .filter((candidate) => candidate.entityType !== 'import_row');
  if (candidates.length === 0) {
    return null;
  }

  if (row.selectedEntityId) {
    return candidates.find((candidate) => candidate.entityId === row.selectedEntityId) ?? null;
  }

  return candidates.length === 1 ? candidates[0] : null;
}

async function buildGroupRosterImportCommitResponse(
  run: GroupRosterImportRunWithRows,
): Promise<GroupRosterImportCommitResponse> {
  const targetGroup = extractRunTargetGroup(run);
  const appliedLeadIds = run.rows
    .map((row) => row.appliedLeadId)
    .filter((value): value is string => Boolean(value));
  const appliedAccountIds = run.rows
    .map((row) => row.appliedAccountId)
    .filter((value): value is string => Boolean(value));

  const [leads, accounts] = await Promise.all([
    appliedLeadIds.length > 0
      ? prisma.lead.findMany({
          where: {
            id: {
              in: appliedLeadIds,
            },
          },
          select: {
            id: true,
            companyName: true,
          },
        })
      : Promise.resolve([]),
    appliedAccountIds.length > 0
      ? prisma.account.findMany({
          where: {
            id: {
              in: appliedAccountIds,
            },
          },
          select: {
            id: true,
            displayName: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const leadMap = new Map(leads.map((lead) => [lead.id, lead.companyName]));
  const accountMap = new Map(accounts.map((account) => [account.id, account.displayName]));

  const skippedRows = run.rows
    .filter((row) => row.status === GroupRosterImportRowStatus.SKIPPED)
    .map((row) => {
      const action = toGroupRosterImportRowActionKey(row.decision);
      return {
        rowNumber: row.rowNumber,
        detail: row.detail,
        ...(action ? { action } : {}),
      };
    });

  return {
    runId: run.id,
    status: toGroupRosterImportRunStatusKey(run.status),
    groupKind: targetGroup.kind,
    groupId: targetGroup.id,
    groupCode: targetGroup.code,
    groupName: targetGroup.name,
    fileName: run.fileName,
    sheetName: run.sheetName,
    ...(run.batchName ? { batchName: run.batchName } : {}),
    ...(run.sourceLabel ? { sourceLabel: run.sourceLabel } : {}),
    ...(run.sourceVersion ? { sourceVersion: run.sourceVersion } : {}),
    ...(run.effectiveDate ? { effectiveDate: run.effectiveDate.toISOString() } : {}),
    totalRows: run.totalRows,
    mappedRows: run.mappedRows,
    readyRowCount: run.readyRowCount,
    attentionRowCount: run.attentionRowCount,
    appliedCount: run.appliedCount,
    skippedCount: run.skippedCount,
    errorCount: run.errorCount,
    createdAt: run.createdAt.toISOString(),
    ...(run.appliedAt ? { appliedAt: run.appliedAt.toISOString() } : {}),
    appliedRecords: [
      ...appliedLeadIds.map((id) => ({
        entityType: 'lead' as const,
        entityId: id,
        title: leadMap.get(id) ?? id,
      })),
      ...appliedAccountIds.map((id) => ({
        entityType: 'account' as const,
        entityId: id,
        title: accountMap.get(id) ?? id,
      })),
    ],
    skippedRows,
    errors: run.rows
      .filter((row) => row.status === GroupRosterImportRowStatus.INVALID || row.status === GroupRosterImportRowStatus.FAILED)
      .map((row) => ({
        rowNumber: row.rowNumber,
        detail: row.detail,
      })),
  };
}

function extractRunTargetGroup(run: GroupRosterImportRunWithRows): RosterTargetGroup {
  if (run.groupKind === GroupRosterImportKind.AFFINITY) {
    if (!run.affinityGroup) {
      throw new Error('Affinity roster import run is missing its target group');
    }
    return {
      kind: 'affinity',
      id: run.affinityGroup.id,
      code: run.affinityGroup.code,
      name: run.affinityGroup.name,
    };
  }

  if (!run.ownershipGroup) {
    throw new Error('Ownership roster import run is missing its target group');
  }
  return {
    kind: 'ownership',
    id: run.ownershipGroup.id,
    code: run.ownershipGroup.code,
    name: run.ownershipGroup.name,
  };
}

async function resolveRosterTargetGroup(
  tx: Prisma.TransactionClient | typeof prisma,
  kind: 'affinity' | 'ownership',
  groupId: string,
): Promise<RosterTargetGroup> {
  const normalizedId = optionalTrimmed(groupId);
  if (!normalizedId) {
    throw new Error('groupId is required');
  }

  if (kind === 'affinity') {
    const group = await tx.affinityGroupRef.findUnique({
      where: { id: normalizedId },
      select: { id: true, code: true, name: true },
    });
    if (!group) {
      throw new Error('Affinity group not found for roster import');
    }
    return { kind, ...group };
  }

  const group = await tx.ownershipGroupRef.findUnique({
    where: { id: normalizedId },
    select: { id: true, code: true, name: true },
  });
  if (!group) {
    throw new Error('Ownership group not found for roster import');
  }
  return { kind, ...group };
}

function buildRosterImportFileDigest(
  fileName: string,
  fileContentBase64: string,
  sheetName: string | undefined,
  targetGroup: RosterTargetGroup,
) {
  return createHash('sha256')
    .update(`${targetGroup.kind}:${targetGroup.id}:${fileName}:${sheetName ?? ''}:${fileContentBase64}`)
    .digest('hex');
}

function parseGroupRosterMatchCandidates(value: Prisma.JsonValue | null): GroupRosterMatchCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return [];
    }

    const entityType = 'entityType' in candidate ? candidate.entityType : undefined;
    const entityId = 'entityId' in candidate ? candidate.entityId : undefined;
    const title = 'title' in candidate ? candidate.title : undefined;
    const confidence = 'confidence' in candidate ? candidate.confidence : undefined;
    const matchedSignals = 'matchedSignals' in candidate && Array.isArray(candidate.matchedSignals)
      ? candidate.matchedSignals.filter((value): value is string => typeof value === 'string')
      : [];
    const subtitle = 'subtitle' in candidate && typeof candidate.subtitle === 'string' ? candidate.subtitle : undefined;
    const detail = 'detail' in candidate && typeof candidate.detail === 'string' ? candidate.detail : undefined;
    const conflictReason = 'conflictReason' in candidate && typeof candidate.conflictReason === 'string'
      ? candidate.conflictReason
      : undefined;

    if (typeof entityType !== 'string' || typeof entityId !== 'string' || typeof title !== 'string' || typeof confidence !== 'string') {
      return [];
    }

    if (entityType !== 'lead' && entityType !== 'account' && entityType !== 'import_row') {
      return [];
    }
    if (confidence !== 'high' && confidence !== 'medium' && confidence !== 'low') {
      return [];
    }

    return [{
      entityType,
      entityId,
      title,
      confidence,
      matchedSignals,
      ...(subtitle ? { subtitle } : {}),
      ...(detail ? { detail } : {}),
      ...(conflictReason ? { conflictReason } : {}),
    }];
  });
}

function toGroupRosterImportRunDetail(run: GroupRosterImportRunWithRows): GroupRosterImportRunDetail {
  const targetGroup = extractRunTargetGroup(run);

  return {
    runId: run.id,
    status: toGroupRosterImportRunStatusKey(run.status),
    groupKind: targetGroup.kind,
    groupId: targetGroup.id,
    groupCode: targetGroup.code,
    groupName: targetGroup.name,
    fileName: run.fileName,
    sheetName: run.sheetName,
    ...(run.batchName ? { batchName: run.batchName } : {}),
    ...(run.sourceLabel ? { sourceLabel: run.sourceLabel } : {}),
    ...(run.sourceVersion ? { sourceVersion: run.sourceVersion } : {}),
    ...(run.effectiveDate ? { effectiveDate: run.effectiveDate.toISOString() } : {}),
    totalRows: run.totalRows,
    mappedRows: run.mappedRows,
    readyRowCount: run.readyRowCount,
    attentionRowCount: run.attentionRowCount,
    appliedCount: run.appliedCount,
    skippedCount: run.skippedCount,
    errorCount: run.errorCount,
    createdAt: run.createdAt.toISOString(),
    ...(run.appliedAt ? { appliedAt: run.appliedAt.toISOString() } : {}),
    rows: run.rows.map((row) => ({
      rowNumber: row.rowNumber,
      status: toGroupRosterImportRowStatusKey(row.status),
      detail: row.detail,
      sourceValues: parseRecordStringMap(row.sourceValues),
      candidates: parseGroupRosterMatchCandidates(row.matchedCandidates),
      ...(row.selectedEntityId ? { selectedEntityId: row.selectedEntityId } : {}),
    })),
  };
}

function parseRecordStringMap(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, candidate]) => (typeof candidate === 'string' ? [[key, candidate]] : [])),
  );
}

function toGroupRosterImportKindEnum(kind: GroupKindKey) {
  return kind === 'affinity' ? GroupRosterImportKind.AFFINITY : GroupRosterImportKind.OWNERSHIP;
}

function toGroupRosterImportRunStatusKey(status: GroupRosterImportRunStatus): 'review_ready' | 'applied' | 'applied_with_errors' {
  switch (status) {
    case GroupRosterImportRunStatus.REVIEW_READY:
      return 'review_ready';
    case GroupRosterImportRunStatus.APPLIED:
      return 'applied';
    case GroupRosterImportRunStatus.APPLIED_WITH_ERRORS:
      return 'applied_with_errors';
  }
}

function toGroupRosterImportRowStatusKey(status: GroupRosterImportRowStatus): 'ready' | 'requires_review' | 'invalid' | 'skipped' | 'applied' | 'failed' {
  switch (status) {
    case GroupRosterImportRowStatus.READY:
      return 'ready';
    case GroupRosterImportRowStatus.REQUIRES_REVIEW:
      return 'requires_review';
    case GroupRosterImportRowStatus.INVALID:
      return 'invalid';
    case GroupRosterImportRowStatus.SKIPPED:
      return 'skipped';
    case GroupRosterImportRowStatus.APPLIED:
      return 'applied';
    case GroupRosterImportRowStatus.FAILED:
      return 'failed';
  }
}

function toGroupRosterImportRowDecisionEnum(action: GroupRosterImportRowActionKey) {
  return action === 'apply' ? GroupRosterImportRowDecision.APPLY : GroupRosterImportRowDecision.SKIP;
}

function toGroupRosterImportRowActionKey(
  decision: GroupRosterImportRowDecision | null | undefined,
): GroupRosterImportRowActionKey | undefined {
  switch (decision) {
    case GroupRosterImportRowDecision.APPLY:
      return 'apply';
    case GroupRosterImportRowDecision.SKIP:
      return 'skip';
    default:
      return undefined;
  }
}

function toSelectedEntityTypeEnum(
  entityType: GroupRosterMatchCandidate['entityType'] | undefined,
): GroupRosterMatchEntityType | undefined {
  switch (entityType) {
    case 'lead':
      return GroupRosterMatchEntityType.LEAD;
    case 'account':
      return GroupRosterMatchEntityType.ACCOUNT;
    default:
      return undefined;
  }
}

function optionalTrimmed(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizePhone(value: string | undefined | null) {
  const digits = value?.replace(/\D+/g, '');
  return digits ? digits : undefined;
}

function normalizeState(value: string | undefined | null) {
  const normalized = optionalTrimmed(value);
  return normalized ? normalized.toUpperCase() : undefined;
}

function parseOptionalDate(value: string | undefined, field: string) {
  const trimmed = optionalTrimmed(value);
  if (!trimmed) {
    return undefined;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid ISO date`);
  }

  return parsed;
}
