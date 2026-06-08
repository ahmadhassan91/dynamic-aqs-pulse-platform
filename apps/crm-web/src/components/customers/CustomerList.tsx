'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Group, Loader, Paper, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { AccountLifecycleStatusKey, AccountSummary } from '@pulse/contracts';
import { fetchAccounts } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';
import {
  EmptyStateMessage,
  WorkbenchAdvancedSection,
  WorkbenchHeader,
  WorkbenchMetricStrip,
  WorkbenchTable,
} from '@/components/ui/Workbench';

export function CustomerList() {
  const { auth, apiBaseUrl, isHydrated } = usePulseSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [lifecycleFilter, setLifecycleFilter] = useState<AccountLifecycleStatusKey | ''>('');
  const [viewMode, setViewMode] = useState<'follow_up' | 'all'>('follow_up');
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setAccounts([]);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
          const response = await fetchAccounts(apiBaseUrl, auth.tokens.accessToken, {
            ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
            ...(lifecycleFilter ? { lifecycleStatus: lifecycleFilter } : {}),
            limit: 200,
          });
          if (!cancelled) {
            setAccounts(response.items);
            setTotalAccounts(response.total ?? response.items.length);
          }
        } catch (error) {
          if (!cancelled) {
            setErrorMessage(error instanceof Error ? error.message : String(error));
          }
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [apiBaseUrl, auth, lifecycleFilter, searchQuery]);

  const attentionAccounts = useMemo(() => accounts.filter(accountNeedsAttention), [accounts]);
  const sourcedFromLeadCount = useMemo(
    () => accounts.filter((account) => account.sourceLeadId).length,
    [accounts],
  );
  const territoryAssignedCount = useMemo(
    () => accounts.filter((account) => account.territoryId).length,
    [accounts],
  );
  const atRiskCount = useMemo(
    () => accounts.filter((account) => account.lifecycleStatus === 'at_risk').length,
    [accounts],
  );
  const activeCount = useMemo(
    () => accounts.filter((account) => account.lifecycleStatus === 'active').length,
    [accounts],
  );

  if (!isHydrated) {
    return <Loader color="blue" />;
  }

  if (!auth) {
    return null;
  }

  return (
    <Stack gap="md">
      <WorkbenchHeader
        eyebrow="Accounts"
        title="Account Management"
        description="Start with account follow-up, then open the profile only when territory, contacts, or locations need cleanup."
        policyText="Source lead, consignment, training, and financial context stay in account detail."
      />

      <Paper withBorder radius="md" p="md">
        <Stack gap="md">
          <Group justify="space-between" align="center" gap="md" wrap="wrap">
            <Stack gap={2}>
              <Text fw={800}>Account work mode</Text>
              <Text size="sm" c="dimmed">
                Start with accounts that need cleanup; switch to the full directory when you are looking up a known account.
              </Text>
            </Stack>
            <SegmentedControl
              value={viewMode}
              onChange={(value) => setViewMode(value as 'follow_up' | 'all')}
              data={[
                { value: 'follow_up', label: `Needs follow-up (${attentionAccounts.length})` },
                { value: 'all', label: `All accounts (${accounts.length})` },
              ]}
            />
          </Group>
          <Group align="end" grow>
            <TextInput
              label="Search accounts"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              placeholder="Search by account name, legal name, or account number"
              leftSection={<IconSearch size={16} />}
            />
            <Select
              label="Lifecycle"
              value={lifecycleFilter}
              onChange={(value) => setLifecycleFilter((value as AccountLifecycleStatusKey | '') ?? '')}
              data={[
                { value: '', label: 'All lifecycle states' },
                { value: 'active', label: 'Active' },
                { value: 'at_risk', label: 'At Risk' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'churned', label: 'Churned' },
              ]}
              clearable={false}
            />
          </Group>
        </Stack>
      </Paper>

      {errorMessage ? (
        <Alert color="red" variant="light">{errorMessage}</Alert>
      ) : null}

      {isLoading ? (
        <Paper withBorder radius="md" p="xl">
          <Group justify="center">
            <Loader color="blue" />
          </Group>
        </Paper>
      ) : viewMode === 'follow_up' ? (
        <AccountFollowUpQueue accounts={attentionAccounts} totalAttention={attentionAccounts.length} />
      ) : (
        <AccountDirectoryTable accounts={accounts} total={totalAccounts} />
      )}

      {viewMode === 'all' ? (
        <WorkbenchAdvancedSection
          title="Account summary"
          description="Summary counts stay available for managers without competing with the follow-up queue."
        >
          <WorkbenchMetricStrip
            metrics={[
              { label: 'At Risk', value: String(atRiskCount), tone: atRiskCount ? 'warning' : 'success' },
              { label: 'Territory Assigned', value: String(territoryAssignedCount) },
              { label: 'Lead-Sourced', value: String(sourcedFromLeadCount), helper: 'Converted lead lineage' },
              { label: 'Active Accounts', value: String(activeCount) },
            ]}
          />
        </WorkbenchAdvancedSection>
      ) : null}
    </Stack>
  );
}

function AccountFollowUpQueue({
  accounts,
  totalAttention,
}: {
  accounts: AccountSummary[];
  totalAttention: number;
}) {
  const visibleAccounts = accounts.slice(0, 8);

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Text fw={800}>Account follow-up queue</Text>
            <Text size="sm" c="dimmed">
              Accounts needing risk review, territory assignment, contacts, or locations.
            </Text>
          </Stack>
          <Badge color={totalAttention ? 'yellow' : 'green'} variant="light">
            {totalAttention ? `${totalAttention} need attention` : 'All clear'}
          </Badge>
        </Group>

        <WorkbenchTable
          rows={visibleAccounts}
          getRowKey={(account) => account.id}
          minWidth={760}
          emptyState={(
            <EmptyStateMessage
              kind="all-clear"
              title="No account follow-up in this view"
              description="Risk, missing territory, missing contacts, and missing locations will appear here."
            />
          )}
          columns={[
            {
              key: 'account',
              header: 'Account',
              render: (account) => (
                <Stack gap={2}>
                  <Text
                    component={Link}
                    href={`/customers/${account.id}`}
                    fw={700}
                    c="blue"
                    style={{ textDecoration: 'none' }}
                  >
                    {account.displayName}
                  </Text>
                  <Text size="xs" c="dimmed">{account.legalName ?? 'Legal name pending'}</Text>
                  {/* UX-A-002: follow-up reason label */}
                  {account.lifecycleReasonNote ? (
                    <Text size="xs" c="orange.7">{account.lifecycleReasonNote}</Text>
                  ) : null}
                </Stack>
              ),
            },
            {
              key: 'next-action',
              header: 'Next action',
              render: (account) => <Text size="sm">{accountNextAction(account)}</Text>,
            },
            {
              key: 'owner',
              header: 'Owner / territory',
              render: (account) => (
                <Stack gap={2}>
                  <Text size="sm">{account.assignedTmName ?? 'TM unassigned'}</Text>
                  <Text size="xs" c="dimmed">{account.territoryName ?? 'Territory pending'}</Text>
                </Stack>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (account) => (
                <Badge color={accountLifecycleColor(account.lifecycleStatus)} variant="light">
                  {formatAccountLifecycle(account.lifecycleStatus)}
                </Badge>
              ),
              width: 140,
            },
          ]}
        />

        {totalAttention > visibleAccounts.length ? (
          <Text size="xs" c="dimmed">
            Showing {visibleAccounts.length} of {totalAttention}. Use search or lifecycle filters to narrow the queue.
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );
}

function AccountDirectoryTable({ accounts, total }: { accounts: AccountSummary[]; total: number }) {
  const isCapped = total > accounts.length;

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Text fw={800}>All accounts</Text>
          <Text size="sm" c="dimmed">Open a profile for contacts, locations, source lead, training, portal, and financial context.</Text>
        </Stack>
        <Badge variant="light" color="blue">{isCapped ? `${accounts.length} of ${total}` : accounts.length}</Badge>
      </Group>
      <WorkbenchTable
        rows={accounts}
        getRowKey={(account) => account.id}
        minWidth={860}
        emptyState={(
          <EmptyStateMessage
            kind="filtered-out"
            title="No accounts match this view"
            description="Try clearing the search text or lifecycle filter."
          />
        )}
        columns={[
          {
            key: 'account',
            header: 'Account',
            render: (account) => (
              <Stack gap={2}>
                <Text
                  component={Link}
                  href={`/customers/${account.id}`}
                  fw={700}
                  c="blue"
                  style={{ textDecoration: 'none' }}
                >
                  {account.displayName}
                </Text>
                <Text size="xs" c="dimmed">{account.legalName ?? 'Legal name pending'}</Text>
              </Stack>
            ),
          },
          {
            key: 'owner-territory',
            header: 'Owner / territory',
            render: (account) => (
              <Stack gap={2}>
                <Text size="sm">{account.territoryName ?? 'Territory pending'}</Text>
                <Text size="xs" c="dimmed">
                  {account.assignedTmName ?? 'TM unassigned'} / {account.assignedRdName ?? 'RD unassigned'}
                </Text>
              </Stack>
            ),
          },
          {
            key: 'profile',
            header: 'Profile',
            render: (account) => (
              <Group gap="xs" wrap="nowrap">
                <Badge variant="light" color={account.contactCount ? 'green' : 'yellow'}>{account.contactCount} contacts</Badge>
                <Badge variant="light" color={account.locationCount ? 'green' : 'yellow'}>{account.locationCount} locations</Badge>
              </Group>
            ),
          },
          {
            key: 'lifecycle',
            header: 'Lifecycle',
            render: (account) => (
              <Stack gap={2} align="flex-start">
                <Badge color={accountLifecycleColor(account.lifecycleStatus)} variant="light">
                  {formatAccountLifecycle(account.lifecycleStatus)}
                </Badge>
                {/* UX-A-002: follow-up reason label below lifecycle badge */}
                {account.lifecycleReasonNote ? (
                  <Text size="xs" c="dimmed">{account.lifecycleReasonNote}</Text>
                ) : null}
              </Stack>
            ),
            width: 140,
          },
          {
            key: 'updated',
            header: 'Updated',
            render: (account) => <Text size="sm">{formatDateLabel(account.updatedAt)}</Text>,
            width: 140,
          },
        ]}
      />
      {isCapped ? (
        <Text size="xs" c="dimmed" ta="right">
          Showing {accounts.length} of {total} accounts — use search or lifecycle filter to narrow.
        </Text>
      ) : null}
    </Stack>
  );
}

function accountNeedsAttention(account: AccountSummary) {
  return (
    account.lifecycleStatus === 'at_risk'
    || !account.territoryId
    || account.contactCount === 0
    || account.locationCount === 0
  );
}

function accountNextAction(account: AccountSummary) {
  if (account.lifecycleStatus === 'at_risk') return 'Review risk status';
  if (!account.territoryId) return 'Assign territory';
  if (account.contactCount === 0) return 'Add contact';
  if (account.locationCount === 0) return 'Add location';
  return 'Review profile';
}

function accountLifecycleColor(status: AccountLifecycleStatusKey) {
  switch (status) {
    case 'active':
      return 'green';
    case 'at_risk':
      return 'yellow';
    case 'inactive':
      return 'gray';
    case 'churned':
      return 'red';
  }
}

function formatAccountLifecycle(status: AccountLifecycleStatusKey) {
  return status === 'at_risk'
    ? 'At Risk'
    : status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
