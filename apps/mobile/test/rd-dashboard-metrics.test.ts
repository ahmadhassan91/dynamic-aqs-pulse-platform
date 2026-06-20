import test from 'node:test';
import assert from 'node:assert/strict';
import type { LeadDashboardResponse, TrainingDashboardResponse } from '@pulse/contracts/reports';
import { deriveRdDashboardSummary, isRdDashboardRole } from '../src/lib/rd-dashboard-metrics.ts';

const now = new Date('2026-06-20T12:00:00.000Z');

test('isRdDashboardRole allows RD/executive/super-admin only', () => {
  assert.equal(isRdDashboardRole('REGIONAL_DIRECTOR'), true);
  assert.equal(isRdDashboardRole('EXECUTIVE'), true);
  assert.equal(isRdDashboardRole('SUPER_ADMIN'), true);
  assert.equal(isRdDashboardRole('TERRITORY_MANAGER'), false);
  assert.equal(isRdDashboardRole(null), false);
  assert.equal(isRdDashboardRole(undefined), false);
});

const lead: LeadDashboardResponse = {
  metrics: { totalActiveLeads: 12, newStageCount: 4, slaAtRiskCount: 2, intakeLast30Days: 3, convertedLeads: 5, totalLeads: 20, conversionRatePct: 25 },
  segmentation: { homeowner: 0, contractor: 0, unspecified: 0 },
  byStage: [],
  bySource: [],
  byState: [],
  generatedAt: now.toISOString(),
};

const training: TrainingDashboardResponse = {
  windowDays: 90,
  metrics: { completedSessions: 7, trainingHours: 9.5, accountsTrained: 5, siteVisits: 2, overduePrograms: 3 },
  byType: [],
  byTrainer: [],
  overdueAccounts: [],
  generatedAt: now.toISOString(),
};

test('deriveRdDashboardSummary composes lead + training + consignment exceptions', () => {
  const summary = deriveRdDashboardSummary({
    lead,
    training,
    consignmentSites: [
      { nextAuditDueAt: '2026-06-18T00:00:00.000Z', openWorkItemCount: 2 }, // overdue + 2 work items
      { nextAuditDueAt: '2026-06-25T00:00:00.000Z', openWorkItemCount: 1 }, // future + 1 work item
      { nextAuditDueAt: null, openWorkItemCount: 0 },
    ],
    now,
  });
  assert.equal(summary.openLeads, 12);
  assert.equal(summary.staleLeads, 2);
  assert.equal(summary.conversionRatePct, 25);
  assert.equal(summary.trainingsCompleted, 7);
  assert.equal(summary.overdueTraining, 3);
  assert.equal(summary.overdueAudits, 1);
  assert.equal(summary.openConsignmentWorkItems, 3);
  assert.equal(summary.openExceptions, 2 + 3 + 1 + 3); // 9
});

test('deriveRdDashboardSummary is null-safe (missing dashboards / sites)', () => {
  const summary = deriveRdDashboardSummary({ now });
  assert.equal(summary.openLeads, 0);
  assert.equal(summary.trainingsCompleted, 0);
  assert.equal(summary.overdueAudits, 0);
  assert.equal(summary.openConsignmentWorkItems, 0);
  assert.equal(summary.openExceptions, 0);
});
