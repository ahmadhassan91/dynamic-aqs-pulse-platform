// CRM-layer reporting contracts — saved definitions, on-demand runs, and scheduled email delivery.
// Scope is deliberately CRM-native data only: revenue/order reporting stays parked with Acumatica.

export const REPORT_KEYS = [
  'lead_funnel',
  'training_compliance',
  'consignment_audit_status',
  'territory_coverage',
  'field_activity',
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

export const REPORT_VISIBILITIES = ['private', 'team', 'org'] as const;
export type ReportVisibilityKey = (typeof REPORT_VISIBILITIES)[number];

export const REPORT_SCHEDULE_CADENCES = ['daily', 'weekly', 'monthly'] as const;
export type ReportScheduleCadenceKey = (typeof REPORT_SCHEDULE_CADENCES)[number];

export const REPORT_DELIVERY_STATUSES = ['sent', 'failed'] as const;
export type ReportDeliveryStatusKey = (typeof REPORT_DELIVERY_STATUSES)[number];

// Per-key configuration. All fields optional — a report with an empty config runs with defaults.
export interface ReportConfig {
  // ISO dates bounding the report window (defaults: last 30 days where a window applies).
  startDate?: string;
  endDate?: string;
  territoryId?: string;
  // lead_funnel: restrict to a lead source code.
  leadSourceCode?: string;
  // field_activity: restrict to a single user.
  userId?: string;
}

export interface ReportColumnSummary {
  key: string;
  label: string;
  kind: 'text' | 'number' | 'date';
}

export interface ReportRunResult {
  reportKey: ReportKey;
  generatedAt: string;
  columns: ReportColumnSummary[];
  rows: Array<Record<string, string | number | null>>;
  rowCount: number;
}

export interface ReportDefinitionSummary {
  id: string;
  name: string;
  description?: string;
  reportKey: ReportKey;
  config: ReportConfig;
  visibility: ReportVisibilityKey;
  ownerUserId: string;
  ownerName?: string;
  isActive: boolean;
  scheduleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportDefinitionRequest {
  name: string;
  description?: string;
  reportKey: ReportKey;
  config?: ReportConfig;
  visibility?: ReportVisibilityKey;
}

export interface UpdateReportDefinitionRequest {
  name?: string;
  description?: string | null;
  config?: ReportConfig;
  visibility?: ReportVisibilityKey;
  isActive?: boolean;
}

export interface ListReportDefinitionsResponse {
  items: ReportDefinitionSummary[];
  total: number;
}

export interface ReportScheduleSummary {
  id: string;
  reportDefinitionId: string;
  reportName?: string;
  cadence: ReportScheduleCadenceKey;
  hourUtc: number;
  recipients: string[];
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportScheduleRequest {
  cadence: ReportScheduleCadenceKey;
  // 0-23; the scheduler runs the report in the first scan after this hour (UTC).
  hourUtc: number;
  recipients: string[];
}

export interface UpdateReportScheduleRequest {
  cadence?: ReportScheduleCadenceKey;
  hourUtc?: number;
  recipients?: string[];
  isActive?: boolean;
}

export interface ListReportSchedulesResponse {
  items: ReportScheduleSummary[];
}

export interface ReportDeliveryRecordSummary {
  id: string;
  scheduleId: string;
  runAt: string;
  status: ReportDeliveryStatusKey;
  detail?: string;
  rowCount: number;
}

export interface ListReportDeliveriesResponse {
  items: ReportDeliveryRecordSummary[];
}

export const REPORT_KEY_LABELS: Record<ReportKey, { label: string; description: string }> = {
  lead_funnel: {
    label: 'Lead funnel',
    description: 'Lead counts by stage and source with SLA-breach visibility.',
  },
  training_compliance: {
    label: 'Training compliance',
    description: 'Per-account training recency: last session, next due, and overdue flags.',
  },
  consignment_audit_status: {
    label: 'Consignment audit status',
    description: 'Consignment sites with ROSE audit due dates, overdue states, and open work items.',
  },
  territory_coverage: {
    label: 'Territory coverage',
    description: 'Territories with state coverage, account counts, and assigned TMs.',
  },
  field_activity: {
    label: 'Field activity',
    description: 'Training sessions and voice notes logged per user in a date range.',
  },
};

// --- Lead dashboard ---------------------------------------------------------
// Role-scoped aggregate KPI view over CRM-native lead data. Scope is applied
// server-side via the actor's lead record scope; no Acumatica/revenue data is
// involved. Counts are a current-pipeline snapshot unless noted otherwise.

export interface LeadDashboardStageBucket {
  // Lowercased LeadStage key (e.g. 'new', 'cis_sent', 'customer_active').
  stage: string;
  label: string;
  count: number;
  avgDaysInStage: number; // FR-RPT-022: avg days leads currently in this stage have sat (0 when empty)
  maxDaysInStage: number; // oldest current lead's days-in-stage (0 when empty)
  staleCount: number; // leads in this stage past the stagnant-stage threshold
}

export interface LeadDashboardCountBucket {
  // Source name or state code; 'Unspecified'/'Unknown' when the field is null.
  key: string;
  count: number;
}

// A lead past its initial-contact SLA and not yet contacted — the actionable
// handoff-risk detail behind the slaAtRiskCount metric (FR-RPT-027).
export interface LeadSlaRiskItem {
  leadId: string;
  companyName: string;
  stage: string; // lowercased LeadStage key
  ownerName: string | null; // assigned TM display name; null if unassigned
  initialContactDueAt: string; // ISO
  daysOverdue: number; // whole days past due (>= 0)
}

export interface LeadDashboardResponse {
  metrics: {
    totalActiveLeads: number; // lifecycleStatus ACTIVE, in scope
    newStageCount: number; // active leads still in the NEW stage
    slaAtRiskCount: number; // active leads past initial-contact due and not yet contacted
    intakeLast30Days: number; // leads created in the last 30 days, in scope
    convertedLeads: number; // leads at CUSTOMER_ACTIVE in the actor's owned book (any lifecycle)
    totalLeads: number; // all leads in the actor's owned book — conversion-rate denominator (any lifecycle)
    conversionRatePct: number; // round(convertedLeads / totalLeads * 100)
  };
  segmentation: {
    homeowner: number;
    contractor: number;
    unspecified: number;
  };
  byStage: LeadDashboardStageBucket[]; // all stages, active leads
  bySource: LeadDashboardCountBucket[]; // top sources by active-lead count
  byState: LeadDashboardCountBucket[]; // top states by active-lead count
  slaAtRisk: LeadSlaRiskItem[]; // active uncontacted leads past initial-contact due — most overdue first (top N)
  generatedAt: string; // ISO
}

// --- Training dashboard -----------------------------------------------------
// Role-scoped aggregate KPI view over CRM-native training data (no Acumatica).
// Session metrics are windowed (last N days); program-overdue is current state.

export interface TrainingDashboardBucket {
  // Training-type name or trainer name; 'Unspecified'/'Unknown'/'Unassigned' when null.
  key: string;
  sessions: number;
  hours: number; // durationMinutes / 60, rounded to 1 decimal
}

export interface TrainingDashboardOverdueAccount {
  account: string;
  nextDueAt: string; // ISO
  daysOverdue: number;
}

export interface TrainingDashboardResponse {
  windowDays: number;
  metrics: {
    completedSessions: number; // all COMPLETED sessions (training + site visits) in window
    trainingHours: number; // hours from COMPLETED training sessions in window
    accountsTrained: number; // distinct accounts with a completed training in window
    siteVisits: number; // COMPLETED site visits in window
    overduePrograms: number; // active/overdue training programs past due (current state)
  };
  byType: TrainingDashboardBucket[]; // top training types by sessions (completed, in window)
  byTrainer: TrainingDashboardBucket[]; // top trainers by hours (completed training, in window)
  overdueAccounts: TrainingDashboardOverdueAccount[]; // most-overdue training programs
  generatedAt: string; // ISO
}

// --- Executive overview -----------------------------------------------------
// Org-wide exec landing (reports.executive gate — EXECUTIVE/SUPER_ADMIN only).
// CRM-native KPIs + a cross-module exception summary. Revenue/financial KPIs are
// parked on Acumatica and intentionally excluded here.

export interface ExecutiveDashboardResponse {
  windowDays: number;
  metrics: {
    openLeads: number; // active leads, org-wide
    activeConsignmentSites: number; // consignment sites in ACTIVE status
    trainingsCompleted: number; // completed training sessions in window
    openExceptions: number; // sum of the exception counts below
  };
  exceptions: {
    overdueAudits: number; // active consignment sites past their next audit date
    overdueTraining: number; // active/overdue training programs past due
    staleLeads: number; // active leads past initial-contact SLA, not yet contacted
    openConsignmentWorkItems: number; // open/in-progress/blocked consignment work items
  };
  generatedAt: string; // ISO
}
