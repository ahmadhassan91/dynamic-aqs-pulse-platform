'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useSearchParams } from 'next/navigation';
import { canPerformAction } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';
import {
  createTrainingCategoryRecord,
  createTrainingTemplateRecord,
  createTrainingTypeRecord,
  fetchTrainingAccounts,
  fetchTrainingCatalog,
  fetchTrainingOverview,
} from '@/lib/pulse-api';
import type {
  CreateTrainingCategoryRequest,
  CreateTrainingTemplateRequest,
  CreateTrainingTypeRequest,
  ListTrainingAccountStatusKey,
  TrainingCatalogResponse,
  TrainingOverviewResponse,
} from '@pulse/contracts';

type CatalogForms = {
  category: CreateTrainingCategoryRequest;
  trainingType: CreateTrainingTypeRequest;
  template: CreateTrainingTemplateRequest;
};

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

export function TrainingWorkspace() {
  const { auth, apiBaseUrl } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState<string | null>(initialTab);
  const [overview, setOverview] = useState<TrainingOverviewResponse | null>(null);
  const [catalog, setCatalog] = useState<TrainingCatalogResponse | null>(null);
  const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof fetchTrainingAccounts>> | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ListTrainingAccountStatusKey>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forms, setForms] = useState<CatalogForms>({
    category: DEFAULT_CATEGORY_FORM,
    trainingType: DEFAULT_TYPE_FORM,
    template: DEFAULT_TEMPLATE_FORM,
  });

  const canManageCatalog = auth ? canPerformAction(auth.identity.role, 'training.catalog_manage') : false;

  const loadWorkspace = useCallback(async () => {
    if (!auth) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [nextOverview, nextCatalog, nextAccounts] = await Promise.all([
        fetchTrainingOverview(apiBaseUrl, accessToken),
        fetchTrainingCatalog(apiBaseUrl, accessToken),
        fetchTrainingAccounts(apiBaseUrl, accessToken, {
          ...(search ? { search } : {}),
          status: statusFilter,
          limit: 100,
        }),
      ]);

      setOverview(nextOverview);
      setCatalog(nextCatalog);
      setAccounts(nextAccounts);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, apiBaseUrl, auth, search, statusFilter]);

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
      <Paper shadow="sm" p="md" style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs">
            <Title order={1}>Training Management</Title>
            <Text size="sm" c="dimmed">
              Manage the Dynamic AQS training catalog, account coverage, certification tracks, and overdue follow-up under the approved Pulse shell.
            </Text>
          </Stack>
          <Group gap="xs">
            {certificationTrackSummary.map((entry) => (
              <Badge key={entry.id} color="violet" variant="light">
                {entry.name}
              </Badge>
            ))}
          </Group>
        </Group>
      </Paper>

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
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Accounts tracked</Text>
              <Text fw={700} size="xl">{overview.totalAccountsTracked}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Active programs</Text>
              <Text fw={700} size="xl">{overview.activePrograms}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Overdue programs</Text>
              <Text fw={700} size="xl" {...(overview.overduePrograms > 0 ? { c: 'red' as const } : {})}>{overview.overduePrograms}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Delivered hours</Text>
              <Text fw={700} size="xl">{overview.deliveredTrainingHours.toFixed(1)}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Certification tracks</Text>
              <Text fw={700} size="xl">{overview.certificationTrackCount}</Text>
            </Card>
          </SimpleGrid>

          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="accounts">Accounts &amp; Training</Tabs.Tab>
              <Tabs.Tab value="catalog">Catalog</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="overview" pt="lg">
              <SimpleGrid cols={{ base: 1, lg: 2 }}>
                <Paper withBorder radius="md" p="lg">
                  <Stack gap="sm">
                    <Title order={4}>Current certified tracks</Title>
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
                    <Title order={4}>Catalog snapshot</Title>
                    <Text size="sm" c="dimmed">
                      Training Slice A keeps scheduling/provider work parked and focuses on the catalog, account history, overdue coverage, and certification-ready structure.
                    </Text>
                    <Divider />
                    <Text size="sm">Categories: {overview.categoryCount}</Text>
                    <Text size="sm">Training types: {overview.trainingTypeCount}</Text>
                    <Text size="sm">Templates: {overview.templateCount}</Text>
                    <Text size="sm">Scheduled sessions: {overview.scheduledSessions}</Text>
                    <Text size="sm">Completed sessions: {overview.completedSessions}</Text>
                  </Stack>
                </Paper>
              </SimpleGrid>
            </Tabs.Panel>

            <Tabs.Panel value="accounts" pt="lg">
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
                        </Table.Tr>
                      )) : (
                        <Table.Tr>
                          <Table.Td colSpan={6}>
                            <Text c="dimmed">No account training records match the current filters yet.</Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="catalog" pt="lg">
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, lg: 3 }}>
                  <Paper withBorder radius="md" p="lg">
                    <Stack gap="sm">
                      <Title order={4}>Add category</Title>
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
                      <TextInput
                        label="Code"
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
                      <Textarea
                        label="Description"
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
                      <Button onClick={() => void handleCategoryCreate()} disabled={!canManageCatalog} loading={isSaving}>
                        Save Category
                      </Button>
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="md" p="lg">
                    <Stack gap="sm">
                      <Title order={4}>Add training type</Title>
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
                      <Button onClick={() => void handleTypeCreate()} disabled={!canManageCatalog || !forms.trainingType.categoryId} loading={isSaving}>
                        Save Training Type
                      </Button>
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="md" p="lg">
                    <Stack gap="sm">
                      <Title order={4}>Add template</Title>
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
                      <Button onClick={() => void handleTemplateCreate()} disabled={!canManageCatalog || !forms.template.trainingTypeId} loading={isSaving}>
                        Save Template
                      </Button>
                    </Stack>
                  </Paper>
                </SimpleGrid>

                <Paper withBorder radius="md" p="lg">
                  <Stack gap="sm">
                    <Title order={4}>Seeded categories</Title>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Name</Table.Th>
                          <Table.Th>Kind</Table.Th>
                          <Table.Th>Training Types</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {(catalog?.categories ?? []).map((category) => (
                          <Table.Tr key={category.id}>
                            <Table.Td>{category.name}</Table.Td>
                            <Table.Td>{category.kind}</Table.Td>
                            <Table.Td>{category.trainingTypeCount}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Stack>
                </Paper>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </>
      ) : null}
    </Stack>
  );
}
