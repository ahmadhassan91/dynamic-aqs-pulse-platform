'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { IconCalendarPlus, IconClipboardCheck, IconClockEdit } from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { canPerformAction } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';
import {
  EmptyStateMessage,
  RowActionMenu,
  WorkbenchAdvancedSection,
  WorkbenchHeader,
  WorkbenchMoreMenu,
  WorkbenchTable,
} from '@/components/ui/Workbench';
import {
  createTrainingCategoryRecord,
  createTrainingTemplateRecord,
  createTrainingTypeRecord,
  fetchTrainingAccounts,
  fetchTrainingCatalog,
  fetchTrainingCoachingWorkload,
  fetchTrainingOverview,
  fetchTrainingRecertificationQueue,
  fetchTrainingSessions,
  fetchTrainingTrainers,
} from '@/lib/pulse-api';
import type {
  CreateTrainingCategoryRequest,
  CreateTrainingTemplateRequest,
  CreateTrainingTypeRequest,
  ListTrainingComplianceReportResponse,
  ListTrainingAccountStatusKey,
  ListTrainingOperationalQueueResponse,
  ListTrainingRecertificationQueueResponse,
  ListTrainingSessionsResponse,
  ListTrainingSessionStatusKey,
  ResolveTrainingCertificationDecisionRequest,
  RevokeTrainingCertificationRequest,
  TrainingCatalogResponse,
  TrainingCoachingWorkloadResponse,
  TrainingOperationalCertificationQueueItem,
  TrainingOperationalExceptionQueueItem,
  TrainingOverviewResponse,
  TrainingSessionSummary,
  TrainingTrainerSummary,
} from '@pulse/contracts';
import { TrainingCertificationOpsModal } from './TrainingCertificationOpsModal';
import { TrainingSessionExecutionModal } from './TrainingSessionExecutionModal';
import { TrainingSessionSchedulerModal } from './TrainingSessionSchedulerModal';

type CatalogForms = {
  category: CreateTrainingCategoryRequest;
  trainingType: CreateTrainingTypeRequest;
  template: CreateTrainingTemplateRequest;
};
type TrainingOpsQueueView = 'recertification' | 'coaching' | 'proof' | 'cadence' | 'exceptions';
type TrainingCoachingSessionRow = TrainingCoachingWorkloadResponse['upcomingSessions'][number];
type TrainingOverdueProgramRow = ListTrainingOperationalQueueResponse['overduePrograms'][number];

const TRAINING_OPS_QUEUE_OPTIONS: Array<{ value: TrainingOpsQueueView; label: string }> = [
  { value: 'recertification', label: 'Recertification' },
  { value: 'coaching', label: 'Coaching' },
  { value: 'proof', label: 'Proof Review' },
  { value: 'cadence', label: 'Overdue Cadence' },
  { value: 'exceptions', label: 'Session Issues' },
];

const TRAINING_WORKSPACE_TABS = new Set(['ops', 'sessions', 'accounts', 'overview', 'reports', 'admin']);

function resolveTrainingWorkspaceTab(value: string | null) {
  if (value === 'catalog') {
    return 'admin';
  }
  return value && TRAINING_WORKSPACE_TABS.has(value) ? value : 'ops';
}

const DEFAULT_CATEGORY_FORM: CreateTrainingCategoryRequest = {
  kind: 'custom',
  code: '',
  name: '',
  description: '',
};

const DEFAULT_TYPE_FORM: CreateTrainingTypeRequest = {
  categoryId: '',
  code: '',
  name: '',
  description: '',
  family: 'custom',
  deliveryMode: 'custom',
  defaultDurationMinutes: 60,
};

const DEFAULT_TEMPLATE_FORM: CreateTrainingTemplateRequest = {
  trainingTypeId: '',
  code: '',
  title: '',
  description: '',
  proofRequirement: 'attendance_and_notes',
};

function formatDate(value?: string) {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value?: string) {
  if (!value) {
    return 'Not scheduled';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

async function fetchTrainingOperationalQueue(
  apiBaseUrl: string,
  accessToken: string,
  query: {
    ownerTmUserId?: string;
    ownerRdUserId?: string;
    certificationWindowDays?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (query.ownerTmUserId) {
    params.set('ownerTmUserId', query.ownerTmUserId);
  }
  if (query.ownerRdUserId) {
    params.set('ownerRdUserId', query.ownerRdUserId);
  }
  if (query.certificationWindowDays) {
    params.set('certificationWindowDays', String(query.certificationWindowDays));
  }

  const response = await fetch(
    `${apiBaseUrl}/api/v1/training/ops${params.toString() ? `?${params.toString()}` : ''}`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      payload?.error?.message
      || payload?.detail
      || payload?.message
      || `Training ops queue request failed (${response.status})`,
    );
  }

  return response.json() as Promise<ListTrainingOperationalQueueResponse>;
}

async function fetchTrainingComplianceReport(
  apiBaseUrl: string,
  accessToken: string,
  query: {
    ownerTmUserId?: string;
    ownerRdUserId?: string;
    certificationWindowDays?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (query.ownerTmUserId) {
    params.set('ownerTmUserId', query.ownerTmUserId);
  }
  if (query.ownerRdUserId) {
    params.set('ownerRdUserId', query.ownerRdUserId);
  }
  if (query.certificationWindowDays) {
    params.set('certificationWindowDays', String(query.certificationWindowDays));
  }

  const response = await fetch(
    `${apiBaseUrl}/api/v1/training/reporting${params.toString() ? `?${params.toString()}` : ''}`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      payload?.error?.message
      || payload?.detail
      || payload?.message
      || `Training compliance report request failed (${response.status})`,
    );
  }

  return response.json() as Promise<ListTrainingComplianceReportResponse>;
}

async function resolveTrainingCertificationDecisionRecord(
  apiBaseUrl: string,
  accessToken: string,
  sessionId: string,
  payload: ResolveTrainingCertificationDecisionRequest,
) {
  const response = await fetch(`${apiBaseUrl}/api/v1/training/sessions/${sessionId}/certification-decision`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(
      errorPayload?.error?.message
      || errorPayload?.detail
      || errorPayload?.message
      || `Resolve certification decision failed (${response.status})`,
    );
  }

  return response.json() as Promise<TrainingSessionSummary>;
}

async function revokeTrainingCertificationRecord(
  apiBaseUrl: string,
  accessToken: string,
  certificationId: string,
  payload: RevokeTrainingCertificationRequest,
) {
  const response = await fetch(`${apiBaseUrl}/api/v1/training/certifications/${certificationId}/revoke`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(
      errorPayload?.error?.message
      || errorPayload?.detail
      || errorPayload?.message
      || `Revoke training certification failed (${response.status})`,
    );
  }

  return response.json();
}

function downloadTrainingComplianceCsv(report: ListTrainingComplianceReportResponse) {
  const escape = (value: string | number | undefined) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = [
    ['Section', 'Name', 'Accounts', 'ActiveCerts', 'ExpiringCerts', 'ExpiredCerts', 'RevokedCerts', 'OverduePrograms', 'ExecutionExceptions', 'PendingDecisions', 'Hours'],
    ['Summary', 'All scoped accounts', report.summary.accountsInScope, report.summary.activeCertificationCount, report.summary.expiringCertificationCount, report.summary.expiredCertificationCount, report.summary.revokedCertificationCount, report.summary.overdueProgramCount, report.summary.unresolvedExecutionExceptionCount, report.summary.pendingCertificationDecisionCount, report.summary.deliveredTrainingHours],
    ...report.territoryManagers.map((entry) => ([
      'Territory Manager',
      entry.ownerName,
      entry.accountCount,
      entry.activeCertificationCount,
      entry.expiringCertificationCount,
      entry.expiredCertificationCount,
      entry.revokedCertificationCount,
      entry.overdueProgramCount,
      entry.unresolvedExecutionExceptionCount,
      entry.pendingCertificationDecisionCount,
      entry.deliveredTrainingHours,
    ])),
    ...report.regionalDirectors.map((entry) => ([
      'Regional Director',
      entry.ownerName,
      entry.accountCount,
      entry.activeCertificationCount,
      entry.expiringCertificationCount,
      entry.expiredCertificationCount,
      entry.revokedCertificationCount,
      entry.overdueProgramCount,
      entry.unresolvedExecutionExceptionCount,
      entry.pendingCertificationDecisionCount,
      entry.deliveredTrainingHours,
    ])),
    ...report.certificationTracks.map((entry) => ([
      'Certification Track',
      entry.trainingTypeName ?? entry.trainingTypeCode ?? 'Certification track',
      '',
      entry.activeCertificationCount,
      entry.expiringCertificationCount,
      entry.expiredCertificationCount,
      entry.revokedCertificationCount,
      '',
      '',
      '',
      '',
    ])),
  ];

  const csv = rows.map((row) => row.map((value) => escape(value)).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `training-compliance-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function trainingStatusColor(session: TrainingSessionSummary) {
  if (session.executionState === 'checked_in') {
    return 'orange';
  }
  if (session.isOverdue) {
    return 'red';
  }
  if (session.status === 'completed') {
    return 'green';
  }
  if (session.status === 'cancelled') {
    return 'gray';
  }
  if (session.status === 'no_show') {
    return 'yellow';
  }
  return 'blue';
}

function formatTrainingLabel(value?: string | null) {
  if (!value) {
    return 'Not set';
  }

  const labels: Record<string, string> = {
    attendance_and_notes: 'Attendance and notes',
    cancelled: 'Cancelled',
    certification_decision_pending: 'Needs proof decision',
    checked_in: 'Checked in',
    completed: 'Completed',
    custom: 'Custom',
    no_show: 'No show',
    proof_missing: 'Needs proof',
    proof_rejected: 'Proof needs follow-up',
    scheduled: 'Scheduled',
    site_visit: 'Site visit',
  };

  return labels[value] ?? value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCertificationOutcome(value?: string | null) {
  const labels: Record<string, string> = {
    approved: 'Certified',
    failed: 'Not certified',
    not_applicable: 'Not applicable',
    pending: 'Needs decision',
    revoked: 'Revoked',
  };

  return value ? labels[value] ?? formatTrainingLabel(value) : 'Not set';
}

function exceptionSeverityColor(severity: TrainingOperationalExceptionQueueItem['severity']) {
  if (severity === 'high') {
    return 'red';
  }
  if (severity === 'medium') {
    return 'orange';
  }
  return 'blue';
}

function certificationQueueColor(item: TrainingOperationalCertificationQueueItem) {
  if (item.daysUntilExpiry < 0 || item.status === 'expired') {
    return 'red';
  }
  if (item.daysUntilExpiry <= 14) {
    return 'orange';
  }
  return 'blue';
}

function TrainingQueueAllClear() {
  return (
    <EmptyStateMessage
      kind="all-clear"
      title="No training work needs attention"
      description="Adjust filters if you need to review a narrower owner or due window."
    />
  );
}

export function TrainingWorkspace() {
  const { auth, apiBaseUrl } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = resolveTrainingWorkspaceTab(requestedTab);
  const [activeTab, setActiveTab] = useState<string | null>(initialTab);
  const [opsQueueView, setOpsQueueView] = useState<TrainingOpsQueueView>('recertification');
  const [overview, setOverview] = useState<TrainingOverviewResponse | null>(null);
  const [catalog, setCatalog] = useState<TrainingCatalogResponse | null>(null);
  const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof fetchTrainingAccounts>> | null>(null);
  const [sessions, setSessions] = useState<ListTrainingSessionsResponse | null>(null);
  const [operationalQueue, setOperationalQueue] = useState<ListTrainingOperationalQueueResponse | null>(null);
  const [recertificationQueue, setRecertificationQueue] = useState<ListTrainingRecertificationQueueResponse | null>(null);
  const [coachingWorkload, setCoachingWorkload] = useState<TrainingCoachingWorkloadResponse | null>(null);
  const [complianceReport, setComplianceReport] = useState<ListTrainingComplianceReportResponse | null>(null);
  const [trainers, setTrainers] = useState<TrainingTrainerSummary[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ListTrainingAccountStatusKey>('all');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<ListTrainingSessionStatusKey>('all');
  const [opsTmFilter, setOpsTmFilter] = useState<string | null>(null);
  const [opsRdFilter, setOpsRdFilter] = useState<string | null>(null);
  const [opsCertificationWindowDays, setOpsCertificationWindowDays] = useState<string>('45');
  const [includeVisits, setIncludeVisits] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [catalogSetupStep, setCatalogSetupStep] = useState(0);
  const [forms, setForms] = useState<CatalogForms>({
    category: DEFAULT_CATEGORY_FORM,
    trainingType: DEFAULT_TYPE_FORM,
    template: DEFAULT_TEMPLATE_FORM,
  });
  const [schedulerContext, setSchedulerContext] = useState<{
    accountId: string;
    accountName: string;
    existingSession?: TrainingSessionSummary | null;
  } | null>(null);
  const [executionSession, setExecutionSession] = useState<TrainingSessionSummary | null>(null);
  const [pendingDecisionException, setPendingDecisionException] = useState<TrainingOperationalExceptionQueueItem | null>(null);
  const [revocationCertification, setRevocationCertification] = useState<TrainingOperationalCertificationQueueItem | null>(null);

  const canManageCatalog = auth ? canPerformAction(auth.identity.role, 'training.catalog_manage') : false;
  const canSchedule = auth ? canPerformAction(auth.identity.role, 'training.schedule') : false;

  const loadWorkspace = useCallback(async () => {
    if (!auth) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [
        nextOverview,
        nextCatalog,
        nextAccounts,
        nextSessions,
        nextTrainers,
        nextOperationalQueue,
        nextRecertificationQueue,
        nextCoachingWorkload,
        nextComplianceReport,
      ] = await Promise.all([
        fetchTrainingOverview(apiBaseUrl, accessToken),
        fetchTrainingCatalog(apiBaseUrl, accessToken),
        fetchTrainingAccounts(apiBaseUrl, accessToken, {
          ...(search ? { search } : {}),
          status: statusFilter,
          limit: 100,
        }),
        fetchTrainingSessions(apiBaseUrl, accessToken, {
          status: sessionStatusFilter,
          includeVisits,
          limit: 100,
        }),
        fetchTrainingTrainers(apiBaseUrl, accessToken),
        fetchTrainingOperationalQueue(apiBaseUrl, accessToken, {
          ...(opsTmFilter ? { ownerTmUserId: opsTmFilter } : {}),
          ...(opsRdFilter ? { ownerRdUserId: opsRdFilter } : {}),
          certificationWindowDays: Number(opsCertificationWindowDays || 45),
        }),
        fetchTrainingRecertificationQueue(apiBaseUrl, accessToken, {
          ...(opsTmFilter ? { ownerTmUserId: opsTmFilter } : {}),
          ...(opsRdFilter ? { ownerRdUserId: opsRdFilter } : {}),
          windowDays: Number(opsCertificationWindowDays || 45),
        }),
        fetchTrainingCoachingWorkload(apiBaseUrl, accessToken),
        fetchTrainingComplianceReport(apiBaseUrl, accessToken, {
          ...(opsTmFilter ? { ownerTmUserId: opsTmFilter } : {}),
          ...(opsRdFilter ? { ownerRdUserId: opsRdFilter } : {}),
          certificationWindowDays: Number(opsCertificationWindowDays || 45),
        }),
      ]);

      setOverview(nextOverview);
      setCatalog(nextCatalog);
      setAccounts(nextAccounts);
      setSessions(nextSessions);
      setTrainers(nextTrainers.items);
      setOperationalQueue(nextOperationalQueue);
      setRecertificationQueue(nextRecertificationQueue);
      setCoachingWorkload(nextCoachingWorkload);
      setComplianceReport(nextComplianceReport);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, [
    accessToken,
    apiBaseUrl,
    auth,
    includeVisits,
    opsCertificationWindowDays,
    opsRdFilter,
    opsTmFilter,
    search,
    sessionStatusFilter,
    statusFilter,
  ]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const categoryOptions = (catalog?.categories ?? []).map((entry) => ({
    value: entry.id,
    label: entry.name,
  }));

  const trainingTypeOptions = (catalog?.trainingTypes ?? []).map((entry) => ({
    value: entry.id,
    label: entry.name,
  }));

  const certificationTrackSummary = useMemo(
    () => (catalog?.trainingTypes ?? []).filter((entry) => entry.isCertificationTrack),
    [catalog],
  );

  const tmFilterOptions = useMemo(() => (
    trainers
      .filter((entry) => entry.roleCode === 'TERRITORY_MANAGER')
      .map((entry) => ({ value: entry.userId, label: entry.displayName }))
  ), [trainers]);

  const rdFilterOptions = useMemo(() => (
    trainers
      .filter((entry) => entry.roleCode === 'REGIONAL_DIRECTOR')
      .map((entry) => ({ value: entry.userId, label: entry.displayName }))
  ), [trainers]);

  const proofExceptionItems = useMemo(
    () => (operationalQueue?.unresolvedExecutionExceptions ?? []).filter((entry) => (
      entry.type === 'certification_decision_pending'
      || entry.type === 'proof_missing'
      || entry.type === 'proof_rejected'
    )),
    [operationalQueue],
  );

  const trainingOpsQueueOptions = useMemo(
    () => TRAINING_OPS_QUEUE_OPTIONS.map((option) => {
      if (option.value === 'recertification') {
        return { ...option, count: recertificationQueue?.summary.totalDueCount ?? 0 };
      }
      if (option.value === 'coaching') {
        return { ...option, count: coachingWorkload?.summary.upcomingSessionCount ?? 0 };
      }
      if (option.value === 'proof') {
        return { ...option, count: proofExceptionItems.length };
      }
      if (option.value === 'cadence') {
        return { ...option, count: operationalQueue?.summary.overdueProgramCount ?? 0 };
      }
      return { ...option, count: operationalQueue?.summary.unresolvedExecutionExceptionCount ?? 0 };
    }),
    [
      coachingWorkload?.summary.upcomingSessionCount,
      operationalQueue?.summary.overdueProgramCount,
      operationalQueue?.summary.unresolvedExecutionExceptionCount,
      proofExceptionItems.length,
      recertificationQueue?.summary.totalDueCount,
    ],
  );

  const sessionItems = sessions?.items ?? [];

  const handleResolveCertificationDecision = useCallback(async (payload: ResolveTrainingCertificationDecisionRequest) => {
    if (!auth || !pendingDecisionException) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await resolveTrainingCertificationDecisionRecord(apiBaseUrl, accessToken, pendingDecisionException.sessionId, payload);
      setPendingDecisionException(null);
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }, [accessToken, apiBaseUrl, auth, loadWorkspace, pendingDecisionException]);

  const handleRevokeCertification = useCallback(async (payload: RevokeTrainingCertificationRequest) => {
    if (!auth || !revocationCertification) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await revokeTrainingCertificationRecord(apiBaseUrl, accessToken, revocationCertification.certificationId, payload);
      setRevocationCertification(null);
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }, [accessToken, apiBaseUrl, auth, loadWorkspace, revocationCertification]);

  const handleCategoryCreate = async () => {
    if (!auth) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await createTrainingCategoryRecord(apiBaseUrl, accessToken, forms.category);
      setForms((current) => ({ ...current, category: DEFAULT_CATEGORY_FORM }));
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTypeCreate = async () => {
    if (!auth) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await createTrainingTypeRecord(apiBaseUrl, accessToken, {
        ...forms.trainingType,
        defaultDurationMinutes: Number(forms.trainingType.defaultDurationMinutes || 0),
      });
      setForms((current) => ({ ...current, trainingType: DEFAULT_TYPE_FORM }));
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemplateCreate = async () => {
    if (!auth) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await createTrainingTemplateRecord(apiBaseUrl, accessToken, forms.template);
      setForms((current) => ({ ...current, template: DEFAULT_TEMPLATE_FORM }));
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Stack gap="md">
      <WorkbenchHeader
        eyebrow="Field training"
        title="Training Workbench"
        description="Run scheduled sessions, proof review, recertification work, and training exceptions from one workbench."
        policyText="Priority work stays first. Coverage, reports, and setup stay in More."
        primaryAction={(
          <Button
            leftSection={<IconCalendarPlus size={16} />}
            onClick={() => setActiveTab('accounts')}
            disabled={!canSchedule}
          >
            Schedule Training
          </Button>
        )}
      />

      {errorMessage ? <Alert color="red" variant="light">{errorMessage}</Alert> : null}

      {isLoading && !overview ? (
        <Card withBorder radius="md" p="xl">
          <Group justify="center">
            <Loader color="blue" />
          </Group>
        </Card>
      ) : null}

      {overview ? (
        <>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="ops">Priority Queue</Tabs.Tab>
              <WorkbenchMoreMenu
                label={activeTab === 'sessions' ? 'Scheduled Sessions' : activeTab === 'accounts' ? 'Account Coverage' : activeTab === 'overview' ? 'Coverage Summary' : activeTab === 'reports' ? 'Compliance Reports' : activeTab === 'admin' ? 'Catalog Setup' : 'More'}
                items={[
                  {
                    id: 'training-sessions',
                    label: 'Scheduled Sessions',
                    description: 'Review and update scheduled training.',
                    onClick: () => setActiveTab('sessions'),
                  },
                  {
                    id: 'training-accounts',
                    label: 'Account Coverage',
                    description: 'Find accounts and schedule training.',
                    onClick: () => setActiveTab('accounts'),
                  },
                  {
                    id: 'training-overview',
                    label: 'Coverage Summary',
                    description: 'Certified tracks and session snapshot.',
                    onClick: () => setActiveTab('overview'),
                  },
                  {
                    id: 'training-reports',
                    label: 'Compliance Reports',
                    description: 'Owner rollups and compliance export.',
                    onClick: () => setActiveTab('reports'),
                  },
                  {
                    id: 'training-admin',
                    label: 'Catalog Setup',
                    description: 'Guided category, type, and template setup.',
                    onClick: () => setActiveTab('admin'),
                  },
                ]}
              />
            </Tabs.List>

            <Tabs.Panel value="overview" pt="lg" data-testid="training-overview-panel">
              <SimpleGrid cols={{ base: 1, lg: 2 }}>
                <Paper withBorder radius="md" p="lg">
                  <Stack gap="sm">
                    <Title order={4}>Current certified tracks</Title>
                    <SimpleGrid cols={{ base: 1, sm: 3 }}>
                      <Card withBorder radius="md" p="md">
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Accounts tracked</Text>
                        <Text fw={700} size="xl">{overview.totalAccountsTracked}</Text>
                      </Card>
                      <Card withBorder radius="md" p="md">
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Active programs</Text>
                        <Text fw={700} size="xl">{overview.activePrograms}</Text>
                      </Card>
                      <Card withBorder radius="md" p="md">
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Active certifications</Text>
                        <Text fw={700} size="xl">{overview.activeCertificationCount}</Text>
                      </Card>
                    </SimpleGrid>
                    {(catalog?.trainingTypes ?? []).filter((entry) => entry.isCertificationTrack).map((entry) => (
                      <Card key={entry.id} withBorder radius="md" p="md">
                        <Stack gap={4}>
                          <Group justify="space-between">
                            <Text fw={600}>{entry.name}</Text>
                            <Badge color="violet" variant="light">Certification</Badge>
                          </Group>
                          <Text size="sm" c="dimmed">{entry.description ?? 'No description provided yet.'}</Text>
                        </Stack>
                      </Card>
                    ))}
                  </Stack>
                </Paper>
                <Paper withBorder radius="md" p="lg">
                  <Stack gap="sm">
                    <Title order={4}>Session execution snapshot</Title>
                    <Text size="sm" c="dimmed">
                      Scheduling, rescheduling, completion, no-show handling, and follow-up tasks are managed in Pulse. Outlook reflection is policy-gated.
                    </Text>
                    <Divider />
                    <Text size="sm">Scheduled sessions: {sessions?.total ?? 0}</Text>
                    <Text size="sm">Overdue sessions: {sessions?.overdueCount ?? 0}</Text>
                    <Text size="sm">Open follow-up tasks: {sessions?.openFollowUpTaskCount ?? 0}</Text>
                    <Text size="sm">Execution exceptions: {sessions?.executionExceptions.length ?? 0}</Text>
                    <Text size="sm">Available trainers: {trainers.filter((entry) => entry.isActive).length}</Text>
                  </Stack>
                </Paper>
              </SimpleGrid>
            </Tabs.Panel>

            <Tabs.Panel value="accounts" pt="lg" data-testid="training-accounts-panel">
              <Stack gap="md">
                <Group justify="space-between" align="flex-end">
                  <TextInput
                    label="Search accounts"
                    placeholder="Search company name"
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                  />
                  <Select
                    label="Coverage filter"
                    value={statusFilter}
                    onChange={(value) => setStatusFilter((value as ListTrainingAccountStatusKey | null) ?? 'all')}
                    data={[
                      { value: 'all', label: 'All accounts' },
                      { value: 'overdue', label: 'Overdue' },
                      { value: 'active_programs', label: 'With active programs' },
                      { value: 'no_programs', label: 'No programs yet' },
                    ]}
                  />
                </Group>

                <Paper withBorder radius="md" p="lg">
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Account</Table.Th>
                        <Table.Th>Territory</Table.Th>
                        <Table.Th>Last Training</Table.Th>
                        <Table.Th>Next Due</Table.Th>
                        <Table.Th>Programs</Table.Th>
                        <Table.Th>Hours</Table.Th>
                        <Table.Th>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {(accounts?.items ?? []).length > 0 ? accounts?.items.map((account) => (
                        <Table.Tr key={account.accountId}>
                          <Table.Td>
                            <Stack gap={0}>
                              <Text fw={600}>{account.accountName}</Text>
                              <Text size="sm" c="dimmed">
                                {account.assignedTmName ?? 'No TM assigned'}
                              </Text>
                            </Stack>
                          </Table.Td>
                          <Table.Td>{account.territoryName ?? account.regionName ?? 'Unassigned'}</Table.Td>
                          <Table.Td>{formatDate(account.lastTrainingAt)}</Table.Td>
                          <Table.Td>{formatDate(account.nextDueAt)}</Table.Td>
                          <Table.Td>
                            <Badge color={account.overdueProgramCount > 0 ? 'red' : 'blue'} variant="light">
                              {account.activeProgramCount} active / {account.overdueProgramCount} overdue
                            </Badge>
                          </Table.Td>
                          <Table.Td>{account.totalTrainingHours.toFixed(1)} hrs</Table.Td>
                          <Table.Td>
                            <RowActionMenu
                              items={[
                                {
                                  id: 'open-account',
                                  label: 'Open account',
                                  onClick: () => router.push(`/customers/${account.accountId}?tab=training-history`),
                                },
                                ...(canSchedule ? [{
                                  id: 'schedule-session',
                                  label: 'Schedule session',
                                  icon: <IconCalendarPlus size={14} />,
                                  onClick: () => setSchedulerContext({
                                    accountId: account.accountId,
                                    accountName: account.accountName,
                                  }),
                                }] : []),
                              ]}
                            />
                          </Table.Td>
                        </Table.Tr>
                      )) : (
                        <Table.Tr>
                          <Table.Td colSpan={8}>
                            <Text c="dimmed">No account training records match the current filters yet.</Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="sessions" pt="lg" data-testid="training-sessions-panel">
              <Stack gap="md">
                <Group justify="space-between" align="flex-end">
                  <Group align="flex-end">
                    <Select
                      label="Session filter"
                      value={sessionStatusFilter}
                      onChange={(value) => setSessionStatusFilter((value as ListTrainingSessionStatusKey | null) ?? 'all')}
                      data={[
                        { value: 'all', label: 'All sessions' },
                        { value: 'scheduled', label: 'Scheduled' },
                        { value: 'checked_in', label: 'Checked in' },
                        { value: 'overdue', label: 'Overdue' },
                        { value: 'exceptions', label: 'Execution exceptions' },
                        { value: 'completed', label: 'Completed' },
                        { value: 'cancelled', label: 'Cancelled' },
                        { value: 'no_show', label: 'No show' },
                      ]}
                    />
                    <Checkbox
                      label="Include site visits"
                      checked={includeVisits}
                      onChange={(event) => setIncludeVisits(event.currentTarget.checked)}
                      mb={6}
                    />
                  </Group>
                  <Badge color={sessions?.overdueCount ? 'red' : 'blue'} variant="light">
                    {sessions?.overdueCount ?? 0} overdue
                  </Badge>
                </Group>

                <Paper withBorder radius="md" p="lg">
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Account</Table.Th>
                        <Table.Th>Session</Table.Th>
                        <Table.Th>Trainer</Table.Th>
                        <Table.Th>Scheduled</Table.Th>
                        <Table.Th>Status</Table.Th>
                        {canSchedule ? <Table.Th>Actions</Table.Th> : null}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {sessionItems.length > 0 ? sessionItems.map((session) => (
                        <Table.Tr key={session.id}>
                          <Table.Td>
                            <Stack gap={0}>
                              <Text fw={600}>{session.accountName ?? 'Account'}</Text>
                              <Text size="sm" c="dimmed">{session.programTitle ?? session.trainingTypeName ?? 'Training session'}</Text>
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <Stack gap={0}>
                              <Text fw={600}>{session.title}</Text>
                              <Text size="sm" c="dimmed">{formatTrainingLabel(session.activityKind)}</Text>
                            </Stack>
                          </Table.Td>
                          <Table.Td>{session.trainerName ?? 'Unassigned'}</Table.Td>
                          <Table.Td>{formatDateTime(session.scheduledAt ?? session.completedAt)}</Table.Td>
                          <Table.Td>
                            <Badge color={trainingStatusColor(session)} variant="light">
                              {formatTrainingLabel(session.executionState)}
                            </Badge>
                            {session.isCertificationTrack ? (
                              <Badge color="violet" variant="light" ml={6}>
                                {formatCertificationOutcome(session.certificationOutcome)}
                              </Badge>
                            ) : null}
                            {session.openFollowUpTaskCount > 0 || session.fieldActivity.length > 0 ? (
                              <Text size="xs" c="dimmed" mt={4}>
                                {session.openFollowUpTaskCount} follow-ups · {session.fieldActivity.length} field notes
                              </Text>
                            ) : null}
                          </Table.Td>
                          {canSchedule ? (
                            <Table.Td>
                              {session.status === 'scheduled' ? (
                                <RowActionMenu
                                  items={[
                                    {
                                      id: 'reschedule',
                                      label: 'Reschedule',
                                      icon: <IconClockEdit size={16} />,
                                      onClick: () => setSchedulerContext({
                                        accountId: session.accountId,
                                        accountName: session.accountName ?? 'Account',
                                        existingSession: session,
                                      }),
                                    },
                                    {
                                      id: 'complete-cancel',
                                      label: 'Update session',
                                      icon: <IconClipboardCheck size={16} />,
                                      onClick: () => setExecutionSession(session),
                                    },
                                  ]}
                                />
                              ) : (
                                <Text size="sm" c="dimmed">Logged</Text>
                              )}
                            </Table.Td>
                          ) : null}
                        </Table.Tr>
                      )) : (
                        <Table.Tr>
                          <Table.Td colSpan={canSchedule ? 6 : 5}>
                            <Text c="dimmed">No training sessions match the current filters yet.</Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Paper>

                {(sessions?.executionExceptions.length ?? 0) > 0 ? (
                  <Text size="sm" c="dimmed">
                    Session issues are handled in the Priority Queue so this list stays focused on scheduled training.
                  </Text>
                ) : null}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="ops" pt="lg" data-testid="training-ops-panel">
              <Stack gap="md">
                <Group justify="space-between" align="flex-end">
                  <WorkbenchAdvancedSection
                    title="Filters"
                    description="Narrow by owner or due window when the queue is too broad."
                  >
                    <Group align="flex-end">
                      <Select
                        label="Territory manager"
                        placeholder="All TMs"
                        clearable
                        data={tmFilterOptions}
                        value={opsTmFilter}
                        onChange={setOpsTmFilter}
                        searchable
                      />
                      <Select
                        label="Regional director"
                        placeholder="All RDs"
                        clearable
                        data={rdFilterOptions}
                        value={opsRdFilter}
                        onChange={setOpsRdFilter}
                        searchable
                      />
                      <Select
                        label="Due window"
                        value={opsCertificationWindowDays}
                        onChange={(value) => setOpsCertificationWindowDays(value ?? '45')}
                        data={[
                          { value: '30', label: 'Next 30 days' },
                          { value: '45', label: 'Next 45 days' },
                          { value: '60', label: 'Next 60 days' },
                          { value: '90', label: 'Next 90 days' },
                        ]}
                      />
                    </Group>
                  </WorkbenchAdvancedSection>
                </Group>

                <Group gap="xs" role="tablist" aria-label="Training priority queues">
                  {trainingOpsQueueOptions.map((option) => (
                    <Button
                      key={option.value}
                      size="xs"
                      variant={opsQueueView === option.value ? 'light' : 'default'}
                      role="tab"
                      aria-selected={opsQueueView === option.value}
                      onClick={() => setOpsQueueView(option.value)}
                      rightSection={(
                        <Badge size="xs" color={option.count > 0 ? (option.value === 'exceptions' ? 'red' : 'orange') : 'gray'} variant="light">
                          {option.count}
                        </Badge>
                      )}
                    >
                      {option.label}
                    </Button>
                  ))}
                </Group>

                <SimpleGrid cols={{ base: 1, xl: 2 }}>
                  <Paper withBorder radius="md" p="lg" style={{ display: opsQueueView === 'recertification' ? undefined : 'none' }}>
                    <Stack gap="sm">
                      <Title order={4}>Recertification queue</Title>
                      <Text size="sm" c="dimmed">
                        Accounts with certifications due inside the current window or already expired.
                      </Text>
                      <WorkbenchTable<TrainingOperationalCertificationQueueItem>
                        ariaLabel="Recertification queue"
                        rows={(recertificationQueue?.items ?? []).slice(0, 6)}
                        getRowKey={(item) => item.certificationId}
                        minWidth={680}
                        withContainer={false}
                        columns={[
                          {
                            key: 'account',
                            header: 'Account',
                            render: (item) => (
                              <Stack gap={0}>
                                <Text fw={600}>{item.accountName}</Text>
                                <Text size="sm" c="dimmed">{item.territoryName ?? item.regionName ?? 'Unassigned territory'}</Text>
                              </Stack>
                            ),
                          },
                          {
                            key: 'certification',
                            header: 'Certification',
                            render: (item) => item.title,
                          },
                          {
                            key: 'due',
                            header: 'Due',
                            render: (item) => (
                              <Badge color={certificationQueueColor(item)} variant="light">
                                {item.daysUntilExpiry >= 0 ? `${item.daysUntilExpiry} days` : `${Math.abs(item.daysUntilExpiry)} days past`}
                              </Badge>
                            ),
                          },
                        ]}
                        emptyState={(
                          <TrainingQueueAllClear />
                        )}
                      />
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="md" p="lg" style={{ display: opsQueueView === 'coaching' ? undefined : 'none' }}>
                    <Stack gap="sm">
                      <Title order={4}>Coaching workload</Title>
                      <Text size="sm" c="dimmed">
                        Upcoming field coaching sessions in your current scope.
                      </Text>
                      <WorkbenchTable<TrainingCoachingSessionRow>
                        ariaLabel="Coaching workload upcoming sessions"
                        rows={(coachingWorkload?.upcomingSessions ?? []).slice(0, 6)}
                        getRowKey={(item) => item.sessionId}
                        minWidth={680}
                        withContainer={false}
                        columns={[
                          {
                            key: 'account',
                            header: 'Account',
                            render: (item) => (
                              <Stack gap={0}>
                                <Text fw={600}>{item.accountName}</Text>
                                <Text size="sm" c="dimmed">{item.territoryName ?? item.regionName ?? 'Unassigned territory'}</Text>
                              </Stack>
                            ),
                          },
                          {
                            key: 'session',
                            header: 'Upcoming session',
                            render: (item) => item.title,
                          },
                          {
                            key: 'scheduled',
                            header: 'Scheduled',
                            render: (item) => formatDateTime(item.scheduledAt),
                          },
                        ]}
                        emptyState={(
                          <TrainingQueueAllClear />
                        )}
                      />
                    </Stack>
                  </Paper>
                </SimpleGrid>

                <Paper withBorder radius="md" p="lg" style={{ display: opsQueueView === 'proof' ? undefined : 'none' }}>
                  <Stack gap="sm">
                    <Title order={4}>Proof and certification review</Title>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Account</Table.Th>
                          <Table.Th>Session</Table.Th>
                          <Table.Th>Detail</Table.Th>
                          {canSchedule ? <Table.Th>Action</Table.Th> : null}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {proofExceptionItems.length > 0 ? proofExceptionItems.map((item) => (
                          <Table.Tr key={`${item.sessionId}-${item.type}`}>
                            <Table.Td>
                              <Stack gap={0}>
                                <Text fw={600}>{item.accountName ?? 'Account'}</Text>
                                <Text size="sm" c="dimmed">{item.territoryName ?? item.regionName ?? 'Unassigned territory'}</Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td>{item.title}</Table.Td>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text size="sm">{item.detail}</Text>
                                <Badge size="xs" color={exceptionSeverityColor(item.severity)} variant="light">
                                  {formatTrainingLabel(item.type)}
                                </Badge>
                              </Stack>
                            </Table.Td>
		                            {canSchedule ? (
		                              <Table.Td>
		                                <RowActionMenu
		                                  items={[
                                      ...(item.type === 'certification_decision_pending' ? [{
                                        id: 'resolve-decision',
                                        label: 'Resolve decision',
                                        onClick: () => setPendingDecisionException(item),
                                      }] : []),
                                      {
                                        id: 'open-account',
                                        label: 'Open account',
                                        onClick: () => router.push(`/customers/${item.accountId}?tab=training-history`),
                                      },
                                    ]}
		                                />
		                              </Table.Td>
		                            ) : null}
                          </Table.Tr>
                        )) : (
                          <Table.Tr>
                            <Table.Td colSpan={canSchedule ? 4 : 3}>
                              <TrainingQueueAllClear />
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                  </Stack>
                </Paper>

                <SimpleGrid cols={{ base: 1, xl: 2 }}>
                  <Paper withBorder radius="md" p="lg" style={{ display: opsQueueView === 'cadence' ? undefined : 'none' }}>
                    <Stack gap="sm">
                      <Title order={4}>Overdue cadence queue</Title>
                      <WorkbenchTable<TrainingOverdueProgramRow>
                        ariaLabel="Overdue cadence queue"
                        rows={operationalQueue?.overduePrograms ?? []}
                        getRowKey={(item) => item.programId}
                        minWidth={760}
                        withContainer={false}
                        columns={[
                          {
                            key: 'account',
                            header: 'Account',
                            render: (item) => (
                              <Stack gap={0}>
                                <Text fw={600}>{item.accountName}</Text>
                                <Text size="sm" c="dimmed">{item.territoryName ?? item.regionName ?? 'Unassigned territory'}</Text>
                              </Stack>
                            ),
                          },
                          {
                            key: 'program',
                            header: 'Program',
                            render: (item) => (
                              <Stack gap={0}>
                                <Text fw={600}>{item.title}</Text>
                                <Text size="sm" c="dimmed">{item.trainingTypeName ?? item.trainingTypeCode ?? 'Training program'}</Text>
                              </Stack>
                            ),
                          },
                          {
                            key: 'next-due',
                            header: 'Next due',
                            render: (item) => (
                              <Stack gap={4}>
                                <Text>{formatDate(item.nextDueAt)}</Text>
                                <Badge color="orange" variant="light">
                                  {item.daysOverdue} days overdue
                                </Badge>
                              </Stack>
                            ),
                          },
                          {
                            key: 'owner',
                            header: 'Owner',
                            render: (item) => item.ownerTmName ?? item.ownerRdName ?? 'Unassigned',
                          },
                        ]}
                        emptyState={(
                          <TrainingQueueAllClear />
                        )}
                      />
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="md" p="lg" style={{ display: opsQueueView === 'exceptions' ? undefined : 'none' }}>
                    <Stack gap="sm">
                      <Title order={4}>Session issues</Title>
                      <WorkbenchTable<TrainingOperationalExceptionQueueItem>
                        ariaLabel="Training execution exceptions"
                        rows={operationalQueue?.unresolvedExecutionExceptions ?? []}
                        getRowKey={(item) => `${item.sessionId}-${item.type}`}
                        minWidth={760}
                        withContainer={false}
                        columns={[
                          {
                            key: 'account',
                            header: 'Account',
                            render: (item) => (
                              <Stack gap={0}>
                                <Text fw={600}>{item.accountName ?? 'Account'}</Text>
                                <Text size="sm" c="dimmed">{item.territoryName ?? item.regionName ?? 'Unassigned territory'}</Text>
                              </Stack>
                            ),
                          },
                          {
                            key: 'issue',
                            header: 'Issue',
                            render: (item) => (
                              <Stack gap={0}>
                                <Text fw={600}>{formatTrainingLabel(item.type)}</Text>
                                <Text size="sm" c="dimmed">{item.detail}</Text>
                              </Stack>
                            ),
                          },
                          {
                            key: 'severity',
                            header: 'Severity',
                            render: (item) => (
                              <Badge color={exceptionSeverityColor(item.severity)} variant="light">
                                {item.severity}
                              </Badge>
                            ),
                          },
                        ]}
                        rowActions={(item) => [{
                          id: 'open-account',
                          label: 'Open account',
                          onClick: () => router.push(`/customers/${item.accountId}?tab=training-history`),
                        }]}
                        emptyState={(
                          <TrainingQueueAllClear />
                        )}
                      />
                    </Stack>
                  </Paper>
                </SimpleGrid>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="reports" pt="lg" data-testid="training-reports-panel">
              <Stack gap="md">
                <Group justify="space-between" align="flex-end">
                  <Group align="flex-end">
                    <Select
                      label="Territory manager"
                      placeholder="All TMs"
                      clearable
                      data={tmFilterOptions}
                      value={opsTmFilter}
                      onChange={setOpsTmFilter}
                      searchable
                    />
                    <Select
                      label="Regional director"
                      placeholder="All RDs"
                      clearable
                      data={rdFilterOptions}
                      value={opsRdFilter}
                      onChange={setOpsRdFilter}
                      searchable
                    />
                    <Select
                      label="Certification window"
                      value={opsCertificationWindowDays}
                      onChange={(value) => setOpsCertificationWindowDays(value ?? '45')}
                      data={[
                        { value: '30', label: 'Next 30 days' },
                        { value: '45', label: 'Next 45 days' },
                        { value: '60', label: 'Next 60 days' },
                        { value: '90', label: 'Next 90 days' },
                      ]}
                    />
                  </Group>
                  <Button
                    variant="default"
                    onClick={() => complianceReport ? downloadTrainingComplianceCsv(complianceReport) : null}
                    disabled={!complianceReport}
                  >
                    Export reporting CSV
                  </Button>
                </Group>

                <Paper withBorder radius="md" p="lg">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={4}>Compliance reporting</Title>
                      <Text size="sm" c="dimmed">
                        Backend-wired owner rollups and certification posture for training ops, TMs, and RDs.
                      </Text>
                    </Group>

                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
                      <Card withBorder radius="md" p="md">
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Scoped accounts</Text>
                        <Text fw={700} size="xl">{complianceReport?.summary.accountsInScope ?? 0}</Text>
                      </Card>
                      <Card withBorder radius="md" p="md">
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Active certifications</Text>
                        <Text fw={700} size="xl">{complianceReport?.summary.activeCertificationCount ?? 0}</Text>
                      </Card>
                      <Card withBorder radius="md" p="md">
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Revoked certifications</Text>
                        <Text
                          fw={700}
                          size="xl"
                          {...((complianceReport?.summary.revokedCertificationCount ?? 0) > 0 ? { c: 'red' as const } : {})}
                        >
                          {complianceReport?.summary.revokedCertificationCount ?? 0}
                        </Text>
                      </Card>
                      <Card withBorder radius="md" p="md">
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Pending decisions</Text>
                        <Text
                          fw={700}
                          size="xl"
                          {...((complianceReport?.summary.pendingCertificationDecisionCount ?? 0) > 0 ? { c: 'orange' as const } : {})}
                        >
                          {complianceReport?.summary.pendingCertificationDecisionCount ?? 0}
                        </Text>
                      </Card>
                      <Card withBorder radius="md" p="md">
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Delivered hours</Text>
                        <Text fw={700} size="xl">{complianceReport?.summary.deliveredTrainingHours ?? 0}</Text>
                      </Card>
                    </SimpleGrid>

                    <SimpleGrid cols={{ base: 1, xl: 3 }}>
                      <Paper withBorder radius="md" p="md">
                        <Stack gap="sm">
                          <Title order={5}>Territory manager rollup</Title>
                          <Table striped highlightOnHover>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>Owner</Table.Th>
                                <Table.Th>Accounts</Table.Th>
                                <Table.Th>Risk</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {(complianceReport?.territoryManagers ?? []).length > 0 ? complianceReport?.territoryManagers.map((entry) => (
                                <Table.Tr key={entry.ownerUserId}>
                                  <Table.Td>{entry.ownerName}</Table.Td>
                                  <Table.Td>{entry.accountCount}</Table.Td>
                                  <Table.Td>{entry.overdueProgramCount + entry.unresolvedExecutionExceptionCount}</Table.Td>
                                </Table.Tr>
                              )) : (
                                <Table.Tr>
                                  <Table.Td colSpan={3}>
                                    <Text c="dimmed">No TM reporting rows are available for the current scope.</Text>
                                  </Table.Td>
                                </Table.Tr>
                              )}
                            </Table.Tbody>
                          </Table>
                        </Stack>
                      </Paper>

                      <Paper withBorder radius="md" p="md">
                        <Stack gap="sm">
                          <Title order={5}>Regional director rollup</Title>
                          <Table striped highlightOnHover>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>Owner</Table.Th>
                                <Table.Th>Accounts</Table.Th>
                                <Table.Th>Risk</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {(complianceReport?.regionalDirectors ?? []).length > 0 ? complianceReport?.regionalDirectors.map((entry) => (
                                <Table.Tr key={entry.ownerUserId}>
                                  <Table.Td>{entry.ownerName}</Table.Td>
                                  <Table.Td>{entry.accountCount}</Table.Td>
                                  <Table.Td>{entry.overdueProgramCount + entry.unresolvedExecutionExceptionCount}</Table.Td>
                                </Table.Tr>
                              )) : (
                                <Table.Tr>
                                  <Table.Td colSpan={3}>
                                    <Text c="dimmed">No RD reporting rows are available for the current scope.</Text>
                                  </Table.Td>
                                </Table.Tr>
                              )}
                            </Table.Tbody>
                          </Table>
                        </Stack>
                      </Paper>

                      <Paper withBorder radius="md" p="md">
                        <Stack gap="sm">
                          <Title order={5}>Certification track posture</Title>
                          <Table striped highlightOnHover>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>Track</Table.Th>
                                <Table.Th>Active</Table.Th>
                                <Table.Th>Expired</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {(complianceReport?.certificationTracks ?? []).length > 0 ? complianceReport?.certificationTracks.map((entry) => (
                                <Table.Tr key={entry.trainingTypeId ?? entry.trainingTypeCode ?? entry.trainingTypeName}>
                                  <Table.Td>{entry.trainingTypeName ?? entry.trainingTypeCode ?? 'Certification track'}</Table.Td>
                                  <Table.Td>{entry.activeCertificationCount}</Table.Td>
                                  <Table.Td>{entry.expiredCertificationCount + entry.revokedCertificationCount}</Table.Td>
                                </Table.Tr>
                              )) : (
                                <Table.Tr>
                                  <Table.Td colSpan={3}>
                                    <Text c="dimmed">No certification-track reporting rows are available for the current scope.</Text>
                                  </Table.Td>
                                </Table.Tr>
                              )}
                            </Table.Tbody>
                          </Table>
                        </Stack>
                      </Paper>
                    </SimpleGrid>
                  </Stack>
                </Paper>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="admin" pt="lg" data-testid="training-catalog-panel">
              <Stack gap="md">
                <Paper withBorder radius="md" p="lg">
                  <Stack gap="md">
                    <Stack gap={4}>
                      <Title order={4}>Catalog Setup</Title>
                      <Text size="sm" c="dimmed">
                        Create the catalog in order: category, training type, then reusable session template.
                      </Text>
                    </Stack>
                    <Stepper active={catalogSetupStep} onStepClick={setCatalogSetupStep} allowNextStepsSelect={false}>
                      <Stepper.Step label="Category" description="Organize training" data-testid="training-category-form">
                        <Stack gap="sm" mt="md">
                          <Select
                            label="Kind"
                            data={[
                              { value: 'onboarding', label: 'Onboarding' },
                              { value: 'product', label: 'Product' },
                              { value: 'technical', label: 'Technical' },
                              { value: 'sales', label: 'Sales' },
                              { value: 'compliance', label: 'Compliance' },
                              { value: 'certification', label: 'Certification' },
                              { value: 'custom', label: 'Custom' },
                              { value: 'visit', label: 'Visit' },
                            ]}
                            value={forms.category.kind}
                            disabled={!canManageCatalog}
                            onChange={(value) => setForms((current) => ({
                              ...current,
                              category: {
                                ...current.category,
                                kind: (value as CreateTrainingCategoryRequest['kind'] | null) ?? 'custom',
                              },
                            }))}
                          />
                          <SimpleGrid cols={{ base: 1, sm: 2 }}>
                            <TextInput
                              label="Code"
                              aria-label="Training category code"
                              data-testid="training-category-code"
                              value={forms.category.code}
                              disabled={!canManageCatalog}
                              onChange={(event) => setForms((current) => ({
                                ...current,
                                category: {
                                  ...current.category,
                                  code: event.currentTarget.value,
                                },
                              }))}
                            />
                            <TextInput
                              label="Name"
                              aria-label="Training category name"
                              data-testid="training-category-name"
                              value={forms.category.name}
                              disabled={!canManageCatalog}
                              onChange={(event) => setForms((current) => ({
                                ...current,
                                category: {
                                  ...current.category,
                                  name: event.currentTarget.value,
                                },
                              }))}
                            />
                          </SimpleGrid>
                          <Textarea
                            label="Description"
                            aria-label="Training category description"
                            data-testid="training-category-description"
                            minRows={2}
                            value={forms.category.description ?? ''}
                            disabled={!canManageCatalog}
                            onChange={(event) => setForms((current) => ({
                              ...current,
                              category: {
                                ...current.category,
                                description: event.currentTarget.value,
                              },
                            }))}
                          />
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">Save this category, then move to Training Type.</Text>
                            <Button data-testid="training-category-save" onClick={() => void handleCategoryCreate()} disabled={!canManageCatalog} loading={isSaving}>
                              Save Category
                            </Button>
                          </Group>
                        </Stack>
                      </Stepper.Step>

                      <Stepper.Step label="Training Type" description="Define delivery">
                        <Stack gap="sm" mt="md">
                          <Select
                            label="Category"
                            data={categoryOptions}
                            value={forms.trainingType.categoryId}
                            disabled={!canManageCatalog}
                            onChange={(value) => setForms((current) => ({
                              ...current,
                              trainingType: {
                                ...current.trainingType,
                                categoryId: value ?? '',
                              },
                            }))}
                          />
                          <SimpleGrid cols={{ base: 1, sm: 2 }}>
                            <TextInput
                              label="Code"
                              value={forms.trainingType.code}
                              disabled={!canManageCatalog}
                              onChange={(event) => setForms((current) => ({
                                ...current,
                                trainingType: {
                                  ...current.trainingType,
                                  code: event.currentTarget.value,
                                },
                              }))}
                            />
                            <TextInput
                              label="Name"
                              value={forms.trainingType.name}
                              disabled={!canManageCatalog}
                              onChange={(event) => setForms((current) => ({
                                ...current,
                                trainingType: {
                                  ...current.trainingType,
                                  name: event.currentTarget.value,
                                },
                              }))}
                            />
                          </SimpleGrid>
                          <Group justify="space-between">
                            <Button variant="default" onClick={() => setCatalogSetupStep(0)}>Back</Button>
                            <Button onClick={() => void handleTypeCreate()} disabled={!canManageCatalog || !forms.trainingType.categoryId} loading={isSaving}>
                              Save Training Type
                            </Button>
                          </Group>
                        </Stack>
                      </Stepper.Step>

                      <Stepper.Step label="Template" description="Reusable session">
                        <Stack gap="sm" mt="md">
                          <Select
                            label="Training type"
                            data={trainingTypeOptions}
                            value={forms.template.trainingTypeId}
                            disabled={!canManageCatalog}
                            onChange={(value) => setForms((current) => ({
                              ...current,
                              template: {
                                ...current.template,
                                trainingTypeId: value ?? '',
                              },
                            }))}
                          />
                          <SimpleGrid cols={{ base: 1, sm: 2 }}>
                            <TextInput
                              label="Code"
                              value={forms.template.code}
                              disabled={!canManageCatalog}
                              onChange={(event) => setForms((current) => ({
                                ...current,
                                template: {
                                  ...current.template,
                                  code: event.currentTarget.value,
                                },
                              }))}
                            />
                            <TextInput
                              label="Title"
                              value={forms.template.title}
                              disabled={!canManageCatalog}
                              onChange={(event) => setForms((current) => ({
                                ...current,
                                template: {
                                  ...current.template,
                                  title: event.currentTarget.value,
                                },
                              }))}
                            />
                          </SimpleGrid>
                          <Group justify="space-between">
                            <Button variant="default" onClick={() => setCatalogSetupStep(1)}>Back</Button>
                            <Button onClick={() => void handleTemplateCreate()} disabled={!canManageCatalog || !forms.template.trainingTypeId} loading={isSaving}>
                              Save Template
                            </Button>
                          </Group>
                        </Stack>
                      </Stepper.Step>
                    </Stepper>
                  </Stack>
                </Paper>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </>
      ) : null}

      {canSchedule && schedulerContext ? (
        <TrainingSessionSchedulerModal
          opened={Boolean(schedulerContext)}
          onClose={() => setSchedulerContext(null)}
          apiBaseUrl={apiBaseUrl}
          accessToken={accessToken}
          accountId={schedulerContext.accountId}
          accountName={schedulerContext.accountName}
          catalog={catalog}
          trainers={trainers}
          existingSession={schedulerContext.existingSession ?? null}
          onSaved={loadWorkspace}
        />
      ) : null}

      {canSchedule && (pendingDecisionException || revocationCertification) ? (
        <TrainingCertificationOpsModal
          opened={Boolean(pendingDecisionException || revocationCertification)}
          mode={pendingDecisionException ? 'resolve_decision' : 'revoke_certification'}
          pendingDecision={pendingDecisionException}
          certification={revocationCertification}
          onClose={() => {
            setPendingDecisionException(null);
            setRevocationCertification(null);
          }}
          onResolveDecision={handleResolveCertificationDecision}
          onRevokeCertification={handleRevokeCertification}
        />
      ) : null}

      {canSchedule ? (
        <TrainingSessionExecutionModal
          opened={Boolean(executionSession)}
          onClose={() => setExecutionSession(null)}
          apiBaseUrl={apiBaseUrl}
          accessToken={accessToken}
          session={executionSession}
          trainers={trainers}
          onSaved={loadWorkspace}
        />
      ) : null}
    </Stack>
  );
}
