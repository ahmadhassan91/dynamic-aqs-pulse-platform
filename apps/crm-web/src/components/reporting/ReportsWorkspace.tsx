'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Select,
  TagsInput,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { IconBriefcase, IconCalendarTime, IconDownload, IconFileText, IconLayoutDashboard, IconPlayerPlay, IconPlus, IconSchool, IconTrash } from '@tabler/icons-react';
import type {
  ReportDefinitionSummary,
  ReportDeliveryRecordSummary,
  ReportKey,
  ReportRunResult,
  ReportScheduleSummary,
} from '@pulse/contracts/reports';

// crm-web imports @pulse/contracts as types only (Turbopack SSR compiles its value bindings to
// `void 0`, which broke /reports prerendering). Runtime label data lives here, typed
// Record<ReportKey, ...> so a new contract key is a compile error until labeled.
const REPORT_KEY_LABELS: Record<ReportKey, { label: string; description: string }> = {
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
const REPORT_KEYS = Object.keys(REPORT_KEY_LABELS) as ReportKey[];
import { usePulseSession } from '@/lib/pulse-session';
import {
  createReportDefinitionApi,
  createReportScheduleApi,
  deleteReportDefinitionApi,
  deleteReportScheduleApi,
  listReportDefinitionsApi,
  listReportDeliveriesApi,
  listReportSchedulesApi,
  runReportDefinitionApi,
  updateReportScheduleApi,
} from '@/lib/pulse-api-ext-reports';
import { WorkbenchHeader } from '@/components/ui/Workbench';
import { LeadDashboard } from '@/components/reporting/LeadDashboard';
import { TrainingDashboard } from '@/components/reporting/TrainingDashboard';
import { ExecutiveDashboard } from '@/components/reporting/ExecutiveDashboard';
import { ReportingThresholdSettingsCard } from '@/components/reporting/ReportingThresholdSettingsCard';
import { StaleAccountsCard } from '@/components/reporting/StaleAccountsCard';
import { canAccessModule, canPerformAction } from '@/lib/access';
import { downloadReportCsv, downloadReportExcel, downloadReportPdf } from '@/lib/report-export';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, '0')}:00 UTC`,
}));

export function ReportsWorkspace() {
  const { auth, apiBaseUrl } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';
  const role = auth?.identity.role;
  // Only surface a dashboard tab the role can actually load (the endpoints gate on
  // lead.view / the training module), so we never render a tab that 403s.
  const showExecutive = Boolean(role && canPerformAction(role, 'reports.executive'));
  const canManageReportingThresholds = Boolean(role && canPerformAction(role, 'admin.integration_manage'));
  const canViewStaleAccounts = Boolean(role && canPerformAction(role, 'customer.view'));
  const showLeads = Boolean(role && canPerformAction(role, 'lead.view'));
  const showTraining = Boolean(role && canAccessModule(role, 'training'));
  const defaultDashboardTab = showExecutive ? 'executive' : showLeads ? 'leads' : showTraining ? 'training' : 'reports';

  const [definitions, setDefinitions] = useState<ReportDefinitionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newKey, setNewKey] = useState<string | null>('lead_funnel');
  const [newVisibility, setNewVisibility] = useState<string | null>('org');
  const [isSaving, setIsSaving] = useState(false);

  const [runResult, setRunResult] = useState<ReportRunResult | null>(null);
  const [runTitle, setRunTitle] = useState('');
  const [runningId, setRunningId] = useState<string | null>(null);

  const [scheduleTarget, setScheduleTarget] = useState<ReportDefinitionSummary | null>(null);
  const [schedules, setSchedules] = useState<ReportScheduleSummary[]>([]);
  const [deliveries, setDeliveries] = useState<ReportDeliveryRecordSummary[]>([]);
  const [scheduleCadence, setScheduleCadence] = useState<string | null>('weekly');
  const [scheduleHour, setScheduleHour] = useState<string | null>('13');
  const [scheduleRecipients, setScheduleRecipients] = useState<string[]>([]);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await listReportDefinitionsApi(apiBaseUrl, accessToken);
      setDefinitions(response.items);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load reports.');
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!accessToken || !newName.trim() || !newKey) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await createReportDefinitionApi(apiBaseUrl, accessToken, {
        name: newName.trim(),
        ...(newDescription.trim() ? { description: newDescription.trim() } : {}),
        reportKey: newKey as ReportKey,
        visibility: (newVisibility ?? 'org') as 'private' | 'team' | 'org',
      });
      setIsCreateOpen(false);
      setNewName('');
      setNewDescription('');
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save the report.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRun(definition: ReportDefinitionSummary) {
    if (!accessToken) return;
    setRunningId(definition.id);
    setErrorMessage(null);
    try {
      const result = await runReportDefinitionApi(apiBaseUrl, accessToken, definition.id);
      setRunResult(result);
      setRunTitle(definition.name);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Report run failed.');
    } finally {
      setRunningId(null);
    }
  }

  async function handleDelete(definition: ReportDefinitionSummary) {
    if (!accessToken) return;
    setErrorMessage(null);
    try {
      await deleteReportDefinitionApi(apiBaseUrl, accessToken, definition.id);
      if (runTitle === definition.name) {
        setRunResult(null);
      }
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not delete the report.');
    }
  }

  const loadSchedules = useCallback(
    async (definition: ReportDefinitionSummary) => {
      if (!accessToken) return;
      const response = await listReportSchedulesApi(apiBaseUrl, accessToken, definition.id);
      setSchedules(response.items);
      const first = response.items[0];
      if (first) {
        const deliveriesResponse = await listReportDeliveriesApi(apiBaseUrl, accessToken, first.id);
        setDeliveries(deliveriesResponse.items);
      } else {
        setDeliveries([]);
      }
    },
    [apiBaseUrl, accessToken],
  );

  async function openSchedules(definition: ReportDefinitionSummary) {
    // Clear the previous report's rows before the modal opens so stale schedules/deliveries
    // never flash under the new report's title.
    setSchedules([]);
    setDeliveries([]);
    setScheduleTarget(definition);
    setScheduleError(null);
    setScheduleRecipients([]);
    try {
      await loadSchedules(definition);
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Could not load schedules.');
    }
  }

  async function handleCreateSchedule() {
    if (!accessToken || !scheduleTarget || !scheduleCadence || !scheduleHour || scheduleRecipients.length === 0) return;
    setScheduleBusy(true);
    setScheduleError(null);
    try {
      await createReportScheduleApi(apiBaseUrl, accessToken, scheduleTarget.id, {
        cadence: scheduleCadence as 'daily' | 'weekly' | 'monthly',
        hourUtc: Number(scheduleHour),
        recipients: scheduleRecipients,
      });
      await loadSchedules(scheduleTarget);
      await load();
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Could not create the schedule.');
    } finally {
      setScheduleBusy(false);
    }
  }

  async function toggleSchedule(schedule: ReportScheduleSummary) {
    if (!accessToken || !scheduleTarget) return;
    setScheduleError(null);
    try {
      await updateReportScheduleApi(apiBaseUrl, accessToken, schedule.id, { isActive: !schedule.isActive });
      await loadSchedules(scheduleTarget);
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Could not update the schedule.');
    }
  }

  async function removeSchedule(schedule: ReportScheduleSummary) {
    if (!accessToken || !scheduleTarget) return;
    setScheduleError(null);
    try {
      await deleteReportScheduleApi(apiBaseUrl, accessToken, schedule.id);
      await loadSchedules(scheduleTarget);
      await load();
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Could not delete the schedule.');
    }
  }

  return (
    <Stack gap="lg">
      <WorkbenchHeader
        eyebrow="CRM Reporting"
        title="Reports"
        description="Role-scoped dashboards plus saved, shareable reports over live CRM data — leads, training, consignment, territories, and field activity — with scheduled email delivery."
        primaryAction={(
          <Button leftSection={<IconPlus size={16} />} onClick={() => setIsCreateOpen(true)}>
            New report
          </Button>
        )}
      />

      <Tabs defaultValue={defaultDashboardTab}>
        <Tabs.List mb="md">
          {showExecutive ? (
            <Tabs.Tab value="executive" leftSection={<IconBriefcase size={16} />}>
              Executive
            </Tabs.Tab>
          ) : null}
          {showLeads ? (
            <Tabs.Tab value="leads" leftSection={<IconLayoutDashboard size={16} />}>
              Leads
            </Tabs.Tab>
          ) : null}
          {showTraining ? (
            <Tabs.Tab value="training" leftSection={<IconSchool size={16} />}>
              Training
            </Tabs.Tab>
          ) : null}
          <Tabs.Tab value="reports" leftSection={<IconFileText size={16} />}>
            Saved reports
          </Tabs.Tab>
        </Tabs.List>

        {showExecutive ? (
          <Tabs.Panel value="executive">
            <ExecutiveDashboard />
          </Tabs.Panel>
        ) : null}

        {showLeads ? (
          <Tabs.Panel value="leads">
            <LeadDashboard />
          </Tabs.Panel>
        ) : null}

        {showTraining ? (
          <Tabs.Panel value="training">
            <TrainingDashboard />
          </Tabs.Panel>
        ) : null}

        <Tabs.Panel value="reports">
          <Stack gap="lg">
      <Alert color="gray" variant="light" title="Revenue reporting arrives with the ERP feed">
        Order and revenue numbers stay in Acumatica until that integration is approved — these reports
        cover the CRM activity layer so the numbers here are always trustworthy.
      </Alert>

      {canManageReportingThresholds ? <ReportingThresholdSettingsCard /> : null}

      {canViewStaleAccounts ? <StaleAccountsCard /> : null}

      {errorMessage ? (
        <Alert color="red" variant="light" title="Something needs attention">
          {errorMessage}
        </Alert>
      ) : null}

      <Card withBorder radius="md" padding="lg">
        <Group justify="space-between" mb="sm">
          <Text fw={700}>Saved reports</Text>
          {isLoading ? <Loader size="xs" /> : <Text size="sm" c="dimmed">{definitions.length} report{definitions.length === 1 ? '' : 's'}</Text>}
        </Group>
        {definitions.length === 0 && !isLoading ? (
          <Text c="dimmed" size="sm">
            No saved reports yet — create one with “New report”. Reports saved as “Everyone” are shared with the whole team.
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Visibility</Table.Th>
                <Table.Th>Owner</Table.Th>
                <Table.Th>Schedules</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {definitions.map((definition) => (
                <Table.Tr key={definition.id}>
                  <Table.Td>
                    <Text fw={600} size="sm">{definition.name}</Text>
                    {definition.description ? <Text size="xs" c="dimmed">{definition.description}</Text> : null}
                  </Table.Td>
                  <Table.Td>{REPORT_KEY_LABELS[definition.reportKey]?.label ?? definition.reportKey}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={definition.visibility === 'private' ? 'gray' : 'blue'}>
                      {definition.visibility === 'private' ? 'Only me' : 'Everyone'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{definition.ownerName ?? '—'}</Table.Td>
                  <Table.Td>{definition.scheduleCount}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button
                        size="compact-sm"
                        variant="light"
                        leftSection={<IconPlayerPlay size={14} />}
                        loading={runningId === definition.id}
                        onClick={() => void handleRun(definition)}
                      >
                        Run
                      </Button>
                      <Button
                        size="compact-sm"
                        variant="default"
                        leftSection={<IconCalendarTime size={14} />}
                        onClick={() => void openSchedules(definition)}
                      >
                        Schedule
                      </Button>
                      <Button
                        size="compact-sm"
                        variant="subtle"
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => void handleDelete(definition)}
                      >
                        Delete
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {runResult ? (
        <Card withBorder radius="md" padding="lg">
          <Group justify="space-between" mb="sm">
            <Text fw={700}>{runTitle}</Text>
            <Group gap="sm">
              <Text size="sm" c="dimmed">
                {runResult.rowCount} row{runResult.rowCount === 1 ? '' : 's'} · generated {new Date(runResult.generatedAt).toLocaleString()}
              </Text>
              {runResult.rowCount > 0 ? (
                <Button.Group>
                  <Button
                    size="compact-sm"
                    variant="light"
                    leftSection={<IconDownload size={14} />}
                    onClick={() => downloadReportCsv(runResult, runTitle)}
                  >
                    CSV
                  </Button>
                  <Button
                    size="compact-sm"
                    variant="light"
                    onClick={() => downloadReportExcel(runResult, runTitle)}
                  >
                    Excel
                  </Button>
                  <Button
                    size="compact-sm"
                    variant="light"
                    onClick={() => {
                      void downloadReportPdf(runResult, runTitle);
                    }}
                  >
                    PDF
                  </Button>
                </Button.Group>
              ) : null}
            </Group>
          </Group>
          {runResult.rowCount === 0 ? (
            <Text c="dimmed" size="sm">No rows for this report’s current filters.</Text>
          ) : (
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  {runResult.columns.map((column) => (
                    <Table.Th key={column.key}>{column.label}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {runResult.rows.map((row, index) => (
                  <Table.Tr key={index}>
                    {runResult.columns.map((column) => (
                      <Table.Td key={column.key}>{row[column.key] ?? '—'}</Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      ) : null}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Modal opened={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New report" centered>
        <Stack gap="md">
          <TextInput label="Name" placeholder="e.g. Weekly lead funnel" value={newName} onChange={(event) => setNewName(event.currentTarget.value)} required />
          <Textarea label="Description" placeholder="What does this report answer?" value={newDescription} onChange={(event) => setNewDescription(event.currentTarget.value)} autosize minRows={2} />
          <Select
            label="Report type"
            data={REPORT_KEYS.map((key) => ({ value: key, label: REPORT_KEY_LABELS[key].label }))}
            value={newKey}
            onChange={setNewKey}
            allowDeselect={false}
          />
          {newKey ? <Text size="xs" c="dimmed">{REPORT_KEY_LABELS[newKey as ReportKey]?.description}</Text> : null}
          <Select
            label="Visibility"
            data={[
              { value: 'org', label: 'Everyone' },
              { value: 'private', label: 'Only me' },
            ]}
            value={newVisibility}
            onChange={setNewVisibility}
            allowDeselect={false}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreate()} loading={isSaving} disabled={!newName.trim()}>Save report</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={scheduleTarget !== null}
        onClose={() => setScheduleTarget(null)}
        title={scheduleTarget ? `Email schedule — ${scheduleTarget.name}` : 'Email schedule'}
        centered
        size="lg"
      >
        <Stack gap="md">
          {scheduleError ? (
            <Alert color="red" variant="light">{scheduleError}</Alert>
          ) : null}
          {schedules.length > 0 ? (
            <Card withBorder radius="md" padding="md">
              <Text fw={600} size="sm" mb="xs">Active schedules</Text>
              <Stack gap="xs">
                {schedules.map((schedule) => (
                  <Group key={schedule.id} justify="space-between">
                    <div>
                      <Text size="sm">
                        {schedule.cadence === 'daily' ? 'Daily' : schedule.cadence === 'weekly' ? 'Weekly (Mondays)' : 'Monthly (1st)'} at {String(schedule.hourUtc).padStart(2, '0')}:00 UTC
                      </Text>
                      <Text size="xs" c="dimmed">
                        To {schedule.recipients.join(', ')} · next {new Date(schedule.nextRunAt).toLocaleString()}
                      </Text>
                    </div>
                    <Group gap="xs">
                      <Badge variant="light" color={schedule.isActive ? 'green' : 'gray'}>
                        {schedule.isActive ? 'Active' : 'Paused'}
                      </Badge>
                      <Button size="compact-xs" variant="default" onClick={() => void toggleSchedule(schedule)}>
                        {schedule.isActive ? 'Pause' : 'Resume'}
                      </Button>
                      <Button size="compact-xs" variant="subtle" color="red" onClick={() => void removeSchedule(schedule)}>
                        Remove
                      </Button>
                    </Group>
                  </Group>
                ))}
              </Stack>
            </Card>
          ) : (
            <Text size="sm" c="dimmed">No schedules yet — add one below and the report emails itself.</Text>
          )}

          <Group grow>
            <Select
              label="Cadence"
              data={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly (Mondays)' },
                { value: 'monthly', label: 'Monthly (1st)' },
              ]}
              value={scheduleCadence}
              onChange={setScheduleCadence}
              allowDeselect={false}
            />
            <Select label="Send at" data={HOUR_OPTIONS} value={scheduleHour} onChange={setScheduleHour} allowDeselect={false} searchable />
          </Group>
          <TagsInput
            label="Recipients"
            placeholder="Type an email and press Enter"
            value={scheduleRecipients}
            onChange={setScheduleRecipients}
            splitChars={[',', ' ']}
          />
          <Text size="xs" c="dimmed">
            Deliveries run in preview mode until mailbox sending is connected — each run is recorded below
            so you can verify the cadence now.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setScheduleTarget(null)}>Close</Button>
            <Button onClick={() => void handleCreateSchedule()} loading={scheduleBusy} disabled={scheduleRecipients.length === 0}>
              Add schedule
            </Button>
          </Group>

          {deliveries.length > 0 ? (
            <Card withBorder radius="md" padding="md">
              <Text fw={600} size="sm" mb="xs">Recent deliveries</Text>
              <Stack gap={4}>
                {deliveries.slice(0, 8).map((delivery) => (
                  <Group key={delivery.id} gap="xs">
                    <Badge size="xs" variant="light" color={delivery.status === 'sent' ? 'green' : 'red'}>
                      {delivery.status}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {new Date(delivery.runAt).toLocaleString()} · {delivery.rowCount} rows{delivery.detail ? ` · ${delivery.detail}` : ''}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Card>
          ) : null}
        </Stack>
      </Modal>
    </Stack>
  );
}
