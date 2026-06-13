import { Prisma, prisma } from '@pulse/db';
import type {
  CreateReportDefinitionRequest,
  CreateReportScheduleRequest,
  ListReportDefinitionsResponse,
  ListReportDeliveriesResponse,
  ListReportSchedulesResponse,
  ReportConfig,
  ReportDefinitionSummary,
  ReportDeliveryRecordSummary,
  ReportKey,
  ReportRunResult,
  ReportScheduleCadenceKey,
  ReportScheduleSummary,
  ReportVisibilityKey,
  UpdateReportDefinitionRequest,
  UpdateReportScheduleRequest,
} from '@pulse/contracts/reports';
import { REPORT_KEYS, REPORT_SCHEDULE_CADENCES, REPORT_VISIBILITIES } from '@pulse/contracts/reports';
import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import type { AuthenticatedActor } from '../auth/types.js';

type ReportDefinitionRecord = Prisma.ReportDefinitionGetPayload<{
  include: { ownerUser: { select: { id: true; displayName: true } }; _count: { select: { schedules: true } } };
}>;

const DEFINITION_INCLUDE = {
  ownerUser: { select: { id: true, displayName: true } },
  _count: { select: { schedules: true } },
} satisfies Prisma.ReportDefinitionInclude;

function toVisibilityKey(value: string): ReportVisibilityKey {
  return value.toLowerCase() as ReportVisibilityKey;
}

function toCadenceKey(value: string): ReportScheduleCadenceKey {
  return value.toLowerCase() as ReportScheduleCadenceKey;
}

function toDefinitionSummary(record: ReportDefinitionRecord): ReportDefinitionSummary {
  const summary: ReportDefinitionSummary = {
    id: record.id,
    name: record.name,
    reportKey: record.reportKey as ReportKey,
    config: (record.config ?? {}) as ReportConfig,
    visibility: toVisibilityKey(record.visibility),
    ownerUserId: record.ownerUserId,
    isActive: record.isActive,
    scheduleCount: record._count.schedules,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
  if (record.description) {
    summary.description = record.description;
  }
  if (record.ownerUser?.displayName) {
    summary.ownerName = record.ownerUser.displayName;
  }
  return summary;
}

function toScheduleSummary(record: Prisma.ReportScheduleGetPayload<{ include: { reportDefinition: { select: { name: true } } } }>): ReportScheduleSummary {
  const summary: ReportScheduleSummary = {
    id: record.id,
    reportDefinitionId: record.reportDefinitionId,
    cadence: toCadenceKey(record.cadence),
    hourUtc: record.hourUtc,
    recipients: record.recipients,
    isActive: record.isActive,
    nextRunAt: record.nextRunAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
  if (record.lastRunAt) {
    summary.lastRunAt = record.lastRunAt.toISOString();
  }
  if (record.reportDefinition?.name) {
    summary.reportName = record.reportDefinition.name;
  }
  return summary;
}

function assertReportKey(value: string): ReportKey {
  if (!(REPORT_KEYS as readonly string[]).includes(value)) {
    throw new Error(`Unknown report key: ${value}`);
  }
  return value as ReportKey;
}

function normalizeConfig(config: ReportConfig | undefined): Prisma.InputJsonValue {
  return (config ?? {}) as Prisma.InputJsonValue;
}

function canManage(actor: AuthenticatedActor, ownerUserId: string) {
  return actor.userId === ownerUserId || actor.role === 'SUPER_ADMIN' || actor.role === 'EXECUTIVE';
}

function visibleWhere(actor: AuthenticatedActor): Prisma.ReportDefinitionWhereInput {
  // PRIVATE definitions are owner-only; TEAM/ORG are visible to all internal users.
  return {
    isActive: true,
    OR: [
      { ownerUserId: actor.userId },
      { visibility: { in: ['TEAM', 'ORG'] } },
    ],
  };
}

export async function listReportDefinitions(actor: AuthenticatedActor): Promise<ListReportDefinitionsResponse> {
  assertModuleAccess(actor.role, 'reports');
  const where = visibleWhere(actor);
  const [items, total] = await Promise.all([
    prisma.reportDefinition.findMany({ where, orderBy: { updatedAt: 'desc' }, include: DEFINITION_INCLUDE }),
    prisma.reportDefinition.count({ where }),
  ]);
  return { items: items.map(toDefinitionSummary), total };
}

export async function createReportDefinition(actor: AuthenticatedActor, input: CreateReportDefinitionRequest): Promise<ReportDefinitionSummary> {
  assertModuleAccess(actor.role, 'reports');
  assertActionAccess(actor.role, 'reports.builder');
  const name = input.name?.trim();
  if (!name) {
    throw new Error('Report name is required');
  }
  const reportKey = assertReportKey(input.reportKey);
  const visibility = input.visibility ?? 'private';
  if (!(REPORT_VISIBILITIES as readonly string[]).includes(visibility)) {
    throw new Error(`Unknown visibility: ${visibility}`);
  }
  const created = await prisma.reportDefinition.create({
    data: {
      name,
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      reportKey,
      config: normalizeConfig(input.config),
      visibility: visibility.toUpperCase() as 'PRIVATE' | 'TEAM' | 'ORG',
      ownerUserId: actor.userId,
    },
    include: DEFINITION_INCLUDE,
  });
  return toDefinitionSummary(created);
}

async function getOwnedDefinition(actor: AuthenticatedActor, definitionId: string) {
  const record = await prisma.reportDefinition.findUnique({ where: { id: definitionId }, include: DEFINITION_INCLUDE });
  if (!record) {
    throw new Error('Report definition not found');
  }
  if (!canManage(actor, record.ownerUserId)) {
    throw new Error('Only the report owner or an admin can modify this report');
  }
  return record;
}

export async function updateReportDefinition(actor: AuthenticatedActor, definitionId: string, input: UpdateReportDefinitionRequest): Promise<ReportDefinitionSummary> {
  assertModuleAccess(actor.role, 'reports');
  await getOwnedDefinition(actor, definitionId);
  const data: Prisma.ReportDefinitionUpdateInput = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error('Report name cannot be empty');
    data.name = name;
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }
  if (input.config !== undefined) {
    data.config = normalizeConfig(input.config);
  }
  if (input.visibility !== undefined) {
    if (!(REPORT_VISIBILITIES as readonly string[]).includes(input.visibility)) {
      throw new Error(`Unknown visibility: ${input.visibility}`);
    }
    data.visibility = input.visibility.toUpperCase() as 'PRIVATE' | 'TEAM' | 'ORG';
  }
  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }
  const updated = await prisma.reportDefinition.update({ where: { id: definitionId }, data, include: DEFINITION_INCLUDE });
  return toDefinitionSummary(updated);
}

export async function deleteReportDefinition(actor: AuthenticatedActor, definitionId: string): Promise<void> {
  assertModuleAccess(actor.role, 'reports');
  await getOwnedDefinition(actor, definitionId);
  await prisma.reportDefinition.delete({ where: { id: definitionId } });
}

export async function runReportDefinition(actor: AuthenticatedActor, definitionId: string): Promise<ReportRunResult> {
  assertModuleAccess(actor.role, 'reports');
  const record = await prisma.reportDefinition.findFirst({ where: { id: definitionId, ...visibleWhere(actor) } });
  if (!record) {
    throw new Error('Report definition not found');
  }
  return executeReport(record.reportKey as ReportKey, (record.config ?? {}) as ReportConfig);
}

export async function runAdHocReport(actor: AuthenticatedActor, reportKey: string, config: ReportConfig | undefined): Promise<ReportRunResult> {
  assertModuleAccess(actor.role, 'reports');
  return executeReport(assertReportKey(reportKey), config ?? {});
}

// --- Report execution -------------------------------------------------------

function reportWindow(config: ReportConfig) {
  const end = config.endDate ? new Date(`${config.endDate}T23:59:59.999Z`) : new Date();
  const start = config.startDate
    ? new Date(`${config.startDate}T00:00:00.000Z`)
    : new Date(end.getTime() - 30 * 86400000);
  return { start, end };
}

export async function executeReport(reportKey: ReportKey, config: ReportConfig): Promise<ReportRunResult> {
  switch (reportKey) {
    case 'lead_funnel':
      return runLeadFunnel(config);
    case 'training_compliance':
      return runTrainingCompliance(config);
    case 'consignment_audit_status':
      return runConsignmentAuditStatus(config);
    case 'territory_coverage':
      return runTerritoryCoverage(config);
    case 'field_activity':
      return runFieldActivity(config);
  }
}

function result(reportKey: ReportKey, columns: ReportRunResult['columns'], rows: ReportRunResult['rows']): ReportRunResult {
  return { reportKey, generatedAt: new Date().toISOString(), columns, rows, rowCount: rows.length };
}

async function runLeadFunnel(config: ReportConfig): Promise<ReportRunResult> {
  const { start, end } = reportWindow(config);
  const where: Prisma.LeadWhereInput = {
    createdAt: { gte: start, lte: end },
    ...(config.territoryId ? { territoryId: config.territoryId } : {}),
  };
  const leads = await prisma.lead.findMany({
    where,
    select: { stage: true, sourceSiteName: true, sourceDetail: true, initialContactDueAt: true, initialContactedAt: true },
    // Safety cap for attacker-controlled date windows; far above Dynamic's lead volume. Moving the
    // aggregation into groupBy queries is the follow-up if volumes ever approach this.
    take: 25_000,
  });
  const byStage = new Map<string, { count: number; slaBreaches: number; sources: Map<string, number> }>();
  const now = new Date();
  for (const lead of leads) {
    const entry = byStage.get(lead.stage) ?? { count: 0, slaBreaches: 0, sources: new Map<string, number>() };
    entry.count += 1;
    const breached = lead.initialContactDueAt && !lead.initialContactedAt && lead.initialContactDueAt < now;
    if (breached) entry.slaBreaches += 1;
    const source = lead.sourceSiteName ?? lead.sourceDetail ?? 'Unknown';
    entry.sources.set(source, (entry.sources.get(source) ?? 0) + 1);
    byStage.set(lead.stage, entry);
  }
  const rows = Array.from(byStage.entries()).map(([stage, entry]) => ({
    stage,
    leadCount: entry.count,
    slaBreaches: entry.slaBreaches,
    topSource: Array.from(entry.sources.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Unknown',
  }));
  return result('lead_funnel', [
    { key: 'stage', label: 'Stage', kind: 'text' },
    { key: 'leadCount', label: 'Leads', kind: 'number' },
    { key: 'slaBreaches', label: 'SLA breaches', kind: 'number' },
    { key: 'topSource', label: 'Top source', kind: 'text' },
  ], rows);
}

async function runTrainingCompliance(config: ReportConfig): Promise<ReportRunResult> {
  const programs = await prisma.accountTrainingProgram.findMany({
    where: { status: 'ACTIVE', ...(config.territoryId ? { account: { territoryId: config.territoryId } } : {}) },
    include: { account: { select: { id: true, displayName: true } } },
  });
  const lastCompleted = await prisma.trainingSession.groupBy({
    by: ['accountId'],
    where: { completedAt: { not: null } },
    _max: { completedAt: true },
  });
  const lastByAccount = new Map(lastCompleted.map((row) => [row.accountId, row._max.completedAt]));
  const now = new Date();
  const rows = programs.map((program) => {
    const last = lastByAccount.get(program.accountId) ?? null;
    return {
      account: program.account.displayName,
      lastCompletedAt: last ? last.toISOString().slice(0, 10) : null,
      nextDueAt: program.nextDueAt ? program.nextDueAt.toISOString().slice(0, 10) : null,
      overdue: program.nextDueAt && program.nextDueAt < now ? 'Yes' : 'No',
    };
  });
  return result('training_compliance', [
    { key: 'account', label: 'Account', kind: 'text' },
    { key: 'lastCompletedAt', label: 'Last training', kind: 'date' },
    { key: 'nextDueAt', label: 'Next due', kind: 'date' },
    { key: 'overdue', label: 'Overdue', kind: 'text' },
  ], rows);
}

async function runConsignmentAuditStatus(config: ReportConfig): Promise<ReportRunResult> {
  const sites = await prisma.consignmentSite.findMany({
    where: { ...(config.territoryId ? { territoryId: config.territoryId } : {}) },
    include: {
      account: { select: { displayName: true } },
      _count: { select: { workItems: { where: { status: { in: ['OPEN', 'IN_PROGRESS', 'BLOCKED'] } } } } },
    },
  });
  const now = new Date();
  const rows = sites.map((site) => ({
    site: site.name,
    account: site.account.displayName,
    status: site.status,
    nextAuditDueAt: site.nextAuditDueAt ? site.nextAuditDueAt.toISOString().slice(0, 10) : null,
    overdue: site.nextAuditDueAt && site.nextAuditDueAt < now ? 'Yes' : 'No',
    openWorkItems: site._count.workItems,
  }));
  return result('consignment_audit_status', [
    { key: 'site', label: 'Site', kind: 'text' },
    { key: 'account', label: 'Account', kind: 'text' },
    { key: 'status', label: 'Status', kind: 'text' },
    { key: 'nextAuditDueAt', label: 'Next ROSE due', kind: 'date' },
    { key: 'overdue', label: 'Overdue', kind: 'text' },
    { key: 'openWorkItems', label: 'Open work items', kind: 'number' },
  ], rows);
}

async function runTerritoryCoverage(config: ReportConfig): Promise<ReportRunResult> {
  const territories = await prisma.territory.findMany({
    where: { ...(config.territoryId ? { id: config.territoryId } : {}) },
    include: {
      managerUser: { select: { displayName: true } },
      stateCoverage: { select: { stateCode: true } },
      _count: { select: { accounts: true } },
    },
  });
  const rows = territories.map((territory) => ({
    territory: territory.name,
    tm: territory.managerUser?.displayName ?? 'Unassigned',
    states: territory.stateCoverage.map((coverage) => coverage.stateCode).sort().join(', '),
    stateCount: territory.stateCoverage.length,
    accounts: territory._count.accounts,
  }));
  return result('territory_coverage', [
    { key: 'territory', label: 'Territory', kind: 'text' },
    { key: 'tm', label: 'Territory manager', kind: 'text' },
    { key: 'states', label: 'States', kind: 'text' },
    { key: 'stateCount', label: 'State count', kind: 'number' },
    { key: 'accounts', label: 'Accounts', kind: 'number' },
  ], rows);
}

async function runFieldActivity(config: ReportConfig): Promise<ReportRunResult> {
  const { start, end } = reportWindow(config);
  const sessionWhere: Prisma.TrainingSessionWhereInput = {
    createdAt: { gte: start, lte: end },
    ...(config.userId ? { trainerUserId: config.userId } : {}),
  };
  const noteWhere: Prisma.MobileVoiceNoteWhereInput = {
    createdAt: { gte: start, lte: end },
    ...(config.userId ? { createdByUserId: config.userId } : {}),
  };
  const [sessions, notes] = await Promise.all([
    prisma.trainingSession.groupBy({ by: ['trainerUserId'], where: sessionWhere, _count: { _all: true } }),
    prisma.mobileVoiceNote.groupBy({ by: ['createdByUserId'], where: noteWhere, _count: { _all: true } }),
  ]);
  const userIds = Array.from(new Set([
    ...sessions.map((row) => row.trainerUserId),
    ...notes.map((row) => row.createdByUserId),
  ].filter((value): value is string => Boolean(value))));
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true } });
  const nameById = new Map(users.map((user) => [user.id, user.displayName]));
  const sessionsByUser = new Map(sessions.map((row) => [row.trainerUserId ?? 'unknown', row._count._all]));
  const notesByUser = new Map(notes.map((row) => [row.createdByUserId ?? 'unknown', row._count._all]));
  const allKeys = Array.from(new Set([...sessionsByUser.keys(), ...notesByUser.keys()]));
  const rows = allKeys.map((userId) => ({
    user: nameById.get(userId) ?? 'Unknown user',
    trainingSessions: sessionsByUser.get(userId) ?? 0,
    voiceNotes: notesByUser.get(userId) ?? 0,
  }));
  return result('field_activity', [
    { key: 'user', label: 'User', kind: 'text' },
    { key: 'trainingSessions', label: 'Training sessions', kind: 'number' },
    { key: 'voiceNotes', label: 'Voice notes', kind: 'number' },
  ], rows);
}

// --- Schedules ---------------------------------------------------------------

export function computeNextRunAt(cadence: ReportScheduleCadenceKey, hourUtc: number, from: Date = new Date()): Date {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hourUtc, 0, 0, 0));
  if (next <= from) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  if (cadence === 'weekly') {
    // Deliver on Mondays.
    while (next.getUTCDay() !== 1) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  } else if (cadence === 'monthly') {
    // Deliver on the 1st.
    while (next.getUTCDate() !== 1) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  }
  return next;
}

function advanceNextRunAt(cadence: ReportScheduleCadenceKey, hourUtc: number, from: Date): Date {
  const bumped = new Date(from.getTime() + 60 * 1000);
  return computeNextRunAt(cadence, hourUtc, bumped);
}

function assertScheduleInput(cadence: string, hourUtc: number, recipients: string[]) {
  if (!(REPORT_SCHEDULE_CADENCES as readonly string[]).includes(cadence)) {
    throw new Error(`Unknown cadence: ${cadence}`);
  }
  if (!Number.isInteger(hourUtc) || hourUtc < 0 || hourUtc > 23) {
    throw new Error('hourUtc must be an integer between 0 and 23');
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error('At least one recipient is required');
  }
  for (const recipient of recipients) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) {
      throw new Error(`Invalid recipient email: ${recipient}`);
    }
  }
}

export async function listReportSchedules(actor: AuthenticatedActor, definitionId: string): Promise<ListReportSchedulesResponse> {
  assertModuleAccess(actor.role, 'reports');
  const definition = await prisma.reportDefinition.findFirst({ where: { id: definitionId, ...visibleWhere(actor) } });
  if (!definition) {
    throw new Error('Report definition not found');
  }
  const items = await prisma.reportSchedule.findMany({
    where: { reportDefinitionId: definitionId },
    orderBy: { createdAt: 'asc' },
    include: { reportDefinition: { select: { name: true } } },
  });
  return { items: items.map(toScheduleSummary) };
}

export async function createReportSchedule(actor: AuthenticatedActor, definitionId: string, input: CreateReportScheduleRequest): Promise<ReportScheduleSummary> {
  assertModuleAccess(actor.role, 'reports');
  await getOwnedDefinition(actor, definitionId);
  assertScheduleInput(input.cadence, input.hourUtc, input.recipients);
  const created = await prisma.reportSchedule.create({
    data: {
      reportDefinitionId: definitionId,
      cadence: input.cadence.toUpperCase() as 'DAILY' | 'WEEKLY' | 'MONTHLY',
      hourUtc: input.hourUtc,
      recipients: input.recipients,
      nextRunAt: computeNextRunAt(input.cadence, input.hourUtc),
    },
    include: { reportDefinition: { select: { name: true } } },
  });
  return toScheduleSummary(created);
}

export async function updateReportSchedule(actor: AuthenticatedActor, scheduleId: string, input: UpdateReportScheduleRequest): Promise<ReportScheduleSummary> {
  assertModuleAccess(actor.role, 'reports');
  const existing = await prisma.reportSchedule.findUnique({
    where: { id: scheduleId },
    include: { reportDefinition: true },
  });
  if (!existing) {
    throw new Error('Report schedule not found');
  }
  if (!canManage(actor, existing.reportDefinition.ownerUserId)) {
    throw new Error('Only the report owner or an admin can modify this schedule');
  }
  const cadence = input.cadence ?? toCadenceKey(existing.cadence);
  const hourUtc = input.hourUtc ?? existing.hourUtc;
  const recipients = input.recipients ?? existing.recipients;
  assertScheduleInput(cadence, hourUtc, recipients);
  const updated = await prisma.reportSchedule.update({
    where: { id: scheduleId },
    data: {
      cadence: cadence.toUpperCase() as 'DAILY' | 'WEEKLY' | 'MONTHLY',
      hourUtc,
      recipients,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      nextRunAt: computeNextRunAt(cadence, hourUtc),
    },
    include: { reportDefinition: { select: { name: true } } },
  });
  return toScheduleSummary(updated);
}

export async function deleteReportSchedule(actor: AuthenticatedActor, scheduleId: string): Promise<void> {
  assertModuleAccess(actor.role, 'reports');
  const existing = await prisma.reportSchedule.findUnique({ where: { id: scheduleId }, include: { reportDefinition: true } });
  if (!existing) {
    throw new Error('Report schedule not found');
  }
  if (!canManage(actor, existing.reportDefinition.ownerUserId)) {
    throw new Error('Only the report owner or an admin can modify this schedule');
  }
  await prisma.reportSchedule.delete({ where: { id: scheduleId } });
}

export async function listReportDeliveries(actor: AuthenticatedActor, scheduleId: string): Promise<ListReportDeliveriesResponse> {
  assertModuleAccess(actor.role, 'reports');
  const schedule = await prisma.reportSchedule.findFirst({
    where: {
      id: scheduleId,
      reportDefinition: { is: visibleWhere(actor) },
    },
  });
  // Deliveries are only visible when the actor can see the same active parent definition surface
  // as the rest of the reports module.
  if (!schedule) {
    throw new Error('Report schedule not found');
  }
  const items = await prisma.reportDeliveryRecord.findMany({
    where: { scheduleId },
    orderBy: { runAt: 'desc' },
    take: 50,
  });
  return {
    items: items.map((record): ReportDeliveryRecordSummary => ({
      id: record.id,
      scheduleId: record.scheduleId,
      runAt: record.runAt.toISOString(),
      status: record.status.toLowerCase() as 'sent' | 'failed',
      ...(record.detail ? { detail: record.detail } : {}),
      rowCount: record.rowCount,
    })),
  };
}

// --- Scheduler scan (invoked by the queue worker) ------------------------------

export interface ReportScheduleScanResult {
  due: number;
  sent: number;
  failed: number;
}

// Runs every due schedule: executes the report, records the delivery (preview mode — the same
// provider-neutral pattern lead alerts use; real mailbox delivery is the parked Graph dependency),
// and advances nextRunAt. Idempotent per scan via the nextRunAt advance.
export async function processDueReportSchedules(now: Date = new Date()): Promise<ReportScheduleScanResult> {
  const due = await prisma.reportSchedule.findMany({
    where: { isActive: true, nextRunAt: { lte: now }, reportDefinition: { isActive: true } },
    include: { reportDefinition: true },
    take: 25,
  });
  let sent = 0;
  let failed = 0;
  for (const schedule of due) {
    const cadence = toCadenceKey(schedule.cadence);
    try {
      const run = await executeReport(
        schedule.reportDefinition.reportKey as ReportKey,
        (schedule.reportDefinition.config ?? {}) as ReportConfig,
      );
      await prisma.$transaction([
        prisma.reportDeliveryRecord.create({
          data: {
            scheduleId: schedule.id,
            status: 'SENT',
            rowCount: run.rowCount,
            detail: `Preview delivery to ${schedule.recipients.join(', ')} (${run.rowCount} rows)`,
          },
        }),
        prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: { lastRunAt: now, nextRunAt: advanceNextRunAt(cadence, schedule.hourUtc, now) },
        }),
      ]);
      sent += 1;
    } catch (error) {
      await prisma.$transaction([
        prisma.reportDeliveryRecord.create({
          data: {
            scheduleId: schedule.id,
            status: 'FAILED',
            detail: error instanceof Error ? error.message : 'Report execution failed',
          },
        }),
        prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: { lastRunAt: now, nextRunAt: advanceNextRunAt(cadence, schedule.hourUtc, now) },
        }),
      ]);
      failed += 1;
    }
  }
  return { due: due.length, sent, failed };
}
