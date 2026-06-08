'use client';

import {
  Alert,
  Badge,
  Card,
  Group,
  Loader,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import {
  EmptyStateMessage,
  WorkbenchTable,
} from '@/components/ui/Workbench';
import type {
  AffinityGroupReferenceSummary,
  BrandLabelReferenceSummary,
  OwnershipGroupReferenceSummary,
  ReferenceValueSummary,
} from '@pulse/contracts';

type ReferenceDataTab = 'affinity' | 'ownership' | 'brand' | 'lead-sources';

export function AdminReferenceDataPanel({
  affinityGroups,
  ownershipGroups,
  brandLabels,
  leadSources,
  isLoading,
  error,
  canManage,
}: {
  affinityGroups: AffinityGroupReferenceSummary[];
  ownershipGroups: OwnershipGroupReferenceSummary[];
  brandLabels: BrandLabelReferenceSummary[];
  leadSources: ReferenceValueSummary[];
  isLoading: boolean;
  error: string | null;
  canManage: boolean;
}) {
  if (isLoading) {
    return (
      <Card withBorder radius="lg" p="xl">
        <Group justify="center">
          <Loader color="blue" />
          <Text>Loading reference data...</Text>
        </Group>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      <Card withBorder radius="lg" p="md">
        <Stack gap={4} mb="md">
          <Title order={3}>Reference data governance</Title>
          <Text size="sm" c="dimmed">
            Affinity groups, ownership groups, brand labels, and lead sources used across lead intake, territory
            assignment, and account classification.
          </Text>
          {!canManage ? (
            <Alert color="blue" variant="light">
              You have read-only access to reference data. Contact a Super Admin or Operations Admin to make changes.
            </Alert>
          ) : (
            <Alert color="blue" variant="light">
              Reference data writes (create, rename, deactivate) are managed via CSV import. Use the bulk import
              workflow in the Lead intake module to update affinity or ownership group rosters.
            </Alert>
          )}
        </Stack>

        {error ? (
          <Alert color="red" mb="md">{error}</Alert>
        ) : null}

        <Tabs defaultValue="affinity" keepMounted={false}>
          <Tabs.List mb="md">
            <Tabs.Tab value="affinity">
              Affinity Groups ({affinityGroups.length})
            </Tabs.Tab>
            <Tabs.Tab value="ownership">
              Ownership Groups ({ownershipGroups.length})
            </Tabs.Tab>
            <Tabs.Tab value="brand">
              Brand Labels ({brandLabels.length})
            </Tabs.Tab>
            <Tabs.Tab value="lead-sources">
              Lead Sources ({leadSources.length})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="affinity">
            <WorkbenchTable<AffinityGroupReferenceSummary>
              ariaLabel="Affinity groups"
              rows={affinityGroups}
              getRowKey={(item) => item.id}
              minWidth={720}
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  render: (item) => (
                    <Stack gap={2}>
                      <Text fw={600} size="sm">{item.name}</Text>
                      {item.shortName ? <Text size="xs" c="dimmed">{item.shortName}</Text> : null}
                    </Stack>
                  ),
                },
                {
                  key: 'code',
                  header: 'Code',
                  render: (item) => <Text size="sm" ff="monospace">{item.code}</Text>,
                },
                {
                  key: 'type',
                  header: 'Type',
                  render: (item) => (
                    <Badge variant="light" color="blue">
                      {item.groupType.replace(/_/g, ' ')}
                    </Badge>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (item) => (
                    <Badge variant="light" color={item.isActive ? 'green' : 'gray'}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  ),
                },
                {
                  key: 'sort',
                  header: 'Sort',
                  render: (item) => <Text size="sm" c="dimmed">{item.sortOrder}</Text>,
                  align: 'right',
                },
              ]}
              emptyState={(
                <EmptyStateMessage
                  kind="no-data"
                  title="No affinity groups defined"
                  description="Import affinity groups via the bulk roster import workflow."
                />
              )}
            />
          </Tabs.Panel>

          <Tabs.Panel value="ownership">
            <WorkbenchTable<OwnershipGroupReferenceSummary>
              ariaLabel="Ownership groups"
              rows={ownershipGroups}
              getRowKey={(item) => item.id}
              minWidth={720}
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  render: (item) => (
                    <Stack gap={2}>
                      <Text fw={600} size="sm">{item.name}</Text>
                      {item.shortName ? <Text size="xs" c="dimmed">{item.shortName}</Text> : null}
                    </Stack>
                  ),
                },
                {
                  key: 'code',
                  header: 'Code',
                  render: (item) => <Text size="sm" ff="monospace">{item.code}</Text>,
                },
                {
                  key: 'type',
                  header: 'Type',
                  render: (item) => (
                    <Badge variant="light" color="violet">
                      {item.ownershipType.replace(/_/g, ' ')}
                    </Badge>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (item) => (
                    <Badge variant="light" color={item.isActive ? 'green' : 'gray'}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  ),
                },
                {
                  key: 'sort',
                  header: 'Sort',
                  render: (item) => <Text size="sm" c="dimmed">{item.sortOrder}</Text>,
                  align: 'right',
                },
              ]}
              emptyState={(
                <EmptyStateMessage
                  kind="no-data"
                  title="No ownership groups defined"
                  description="Import ownership groups via the bulk roster import workflow."
                />
              )}
            />
          </Tabs.Panel>

          <Tabs.Panel value="brand">
            <WorkbenchTable<BrandLabelReferenceSummary>
              ariaLabel="Brand labels"
              rows={brandLabels}
              getRowKey={(item) => item.id}
              minWidth={500}
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  render: (item) => <Text fw={600} size="sm">{item.name}</Text>,
                },
                {
                  key: 'code',
                  header: 'Code',
                  render: (item) => <Text size="sm" ff="monospace">{item.code}</Text>,
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (item) => (
                    <Badge variant="light" color={item.isActive ? 'green' : 'gray'}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  ),
                },
                {
                  key: 'sort',
                  header: 'Sort',
                  render: (item) => <Text size="sm" c="dimmed">{item.sortOrder}</Text>,
                  align: 'right',
                },
              ]}
              emptyState={(
                <EmptyStateMessage
                  kind="no-data"
                  title="No brand labels defined"
                  description="Brand labels are seeded by the data migration process."
                />
              )}
            />
          </Tabs.Panel>

          <Tabs.Panel value="lead-sources">
            <WorkbenchTable<ReferenceValueSummary>
              ariaLabel="Lead sources"
              rows={leadSources}
              getRowKey={(item) => item.id}
              minWidth={600}
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  render: (item) => (
                    <Stack gap={2}>
                      <Text fw={600} size="sm">{item.name}</Text>
                      {item.description ? <Text size="xs" c="dimmed">{item.description}</Text> : null}
                    </Stack>
                  ),
                },
                {
                  key: 'code',
                  header: 'Code',
                  render: (item) => <Text size="sm" ff="monospace">{item.code}</Text>,
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (item) => (
                    <Badge variant="light" color={item.isActive ? 'green' : 'gray'}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  ),
                },
                {
                  key: 'sort',
                  header: 'Sort',
                  render: (item) => <Text size="sm" c="dimmed">{item.sortOrder}</Text>,
                  align: 'right',
                },
              ]}
              emptyState={(
                <EmptyStateMessage
                  kind="no-data"
                  title="No lead sources defined"
                  description="Lead sources are imported during data migration or intake setup."
                />
              )}
            />
          </Tabs.Panel>
        </Tabs>
      </Card>
    </Stack>
  );
}

// Re-export the tab type for workspace usage
export type { ReferenceDataTab };
