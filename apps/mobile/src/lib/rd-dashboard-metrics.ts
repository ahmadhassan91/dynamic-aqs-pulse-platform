import type { LeadDashboardResponse, TrainingDashboardResponse } from '@pulse/contracts/reports';

// FR-MOB-058: a Regional Director rollup assembled CLIENT-SIDE from the RD-scoped /reports/dashboard
// endpoints (RD has reports + lead.view + training, but NOT reports.executive, so the org-wide
// executive endpoint is off-limits — the server already scopes leads/training to the actor's book).
// Pure (no native imports) so it is unit-testable; the screen renders the returned summary.

export function isRdDashboardRole(role: string | null | undefined): boolean {
  return role === 'REGIONAL_DIRECTOR' || role === 'EXECUTIVE' || role === 'SUPER_ADMIN';
}

export interface RdDashboardSummary {
  openLeads: number;
  newLeads: number;
  staleLeads: number;
  conversionRatePct: number;
  trainingsCompleted: number;
  trainingHours: number;
  overdueTraining: number;
  overdueAudits: number;
  openConsignmentWorkItems: number;
  openExceptions: number; // staleLeads + overdueTraining + overdueAudits + openConsignmentWorkItems
}

type ConsignmentSiteLike = { nextAuditDueAt?: string | null; openWorkItemCount?: number | null };

export function deriveRdDashboardSummary(input: {
  lead?: LeadDashboardResponse | null;
  training?: TrainingDashboardResponse | null;
  consignmentSites?: ConsignmentSiteLike[] | null;
  now: Date;
}): RdDashboardSummary {
  const lead = input.lead;
  const training = input.training;
  const sites = input.consignmentSites ?? [];

  const openLeads = lead?.metrics.totalActiveLeads ?? 0;
  const newLeads = lead?.metrics.newStageCount ?? 0;
  const staleLeads = lead?.metrics.slaAtRiskCount ?? 0;
  const conversionRatePct = lead?.metrics.conversionRatePct ?? 0;

  const trainingsCompleted = training?.metrics.completedSessions ?? 0;
  const trainingHours = training?.metrics.trainingHours ?? 0;
  const overdueTraining = training?.metrics.overduePrograms ?? 0;

  // Overdue audits: active-window sites whose next audit is in the past (strict <, mirrors
  // countOverdueRoseSites). Open consignment work: sum of per-site open work-item counts.
  const overdueAudits = sites.filter((site) => {
    if (!site.nextAuditDueAt) return false;
    return new Date(site.nextAuditDueAt).getTime() < input.now.getTime();
  }).length;
  const openConsignmentWorkItems = sites.reduce((sum, site) => sum + (site.openWorkItemCount ?? 0), 0);

  const openExceptions = staleLeads + overdueTraining + overdueAudits + openConsignmentWorkItems;

  return {
    openLeads,
    newLeads,
    staleLeads,
    conversionRatePct,
    trainingsCompleted,
    trainingHours,
    overdueTraining,
    overdueAudits,
    openConsignmentWorkItems,
    openExceptions,
  };
}
