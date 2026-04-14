'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ActionIcon, Alert, Badge, Card, Group, Loader, Paper, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconArrowRight, IconBuildingStore, IconMapPin, IconSearch, IconUsers } from '@tabler/icons-react';
import type { AccountSummary } from '@pulse/contracts';
import { fetchAccounts } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

export function CustomerList() {
  const { auth, apiBaseUrl, isHydrated } = usePulseSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
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
            limit: 50,
          });
          if (!cancelled) {
            setAccounts(response.items);
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
  }, [apiBaseUrl, auth, searchQuery]);

  const sourcedFromLeadCount = useMemo(
    () => accounts.filter((account) => account.sourceLeadId).length,
    [accounts],
  );
  const territoryAssignedCount = useMemo(
    () => accounts.filter((account) => account.territoryId).length,
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
      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={1}>Account Management</Title>
            <Text size="sm" c="dimmed">
              Manage converted customers, territory ownership, source lead lineage, contacts, and locations from the live Pulse customer core.
            </Text>
          </Stack>
          <Badge color="green" variant="light">Live Customer Core</Badge>
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <MetricCard label="Active Accounts" value={String(accounts.filter((account) => account.isActive).length)} icon={<IconBuildingStore size={18} />} />
        <MetricCard label="Lead-Sourced" value={String(sourcedFromLeadCount)} icon={<IconUsers size={18} />} />
        <MetricCard label="Territory Assigned" value={String(territoryAssignedCount)} icon={<IconMapPin size={18} />} />
      </SimpleGrid>

      <Paper withBorder radius="md" p="md">
        <TextInput
          label="Search Accounts"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
          placeholder="Search by account name, legal name, or account number"
          leftSection={<IconSearch size={16} />}
        />
      </Paper>

      {errorMessage ? (
        <Alert color="red" variant="light">{errorMessage}</Alert>
      ) : null}

      <Paper withBorder radius="md" p="md">
        {isLoading ? (
          <Group justify="center" py="xl">
            <Loader color="blue" />
          </Group>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Account</Table.Th>
                <Table.Th>Territory</Table.Th>
                <Table.Th>TM / RD</Table.Th>
                <Table.Th>Contacts</Table.Th>
                <Table.Th>Locations</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {accounts.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text size="sm" c="dimmed" ta="center" py="lg">
                      No accounts match the current search yet.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : accounts.map((account) => (
                <Table.Tr key={account.id}>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text fw={600}>{account.displayName}</Text>
                      <Text size="xs" c="dimmed">{account.legalName ?? 'No legal name recorded'}</Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="sm">{account.territoryName ?? 'Not assigned'}</Text>
                      <Text size="xs" c="dimmed">{account.regionName ?? 'No region'}</Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="sm">{account.assignedTmName ?? 'TM unassigned'}</Text>
                      <Text size="xs" c="dimmed">{account.assignedRdName ?? 'RD unassigned'}</Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>{account.contactCount}</Table.Td>
                  <Table.Td>{account.locationCount}</Table.Td>
                  <Table.Td>
                    <Badge color={account.isActive ? 'green' : 'gray'} variant="light">
                      {account.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {account.sourceLeadId ? (
                      <Badge color="blue" variant="outline">Converted Lead</Badge>
                    ) : (
                      <Badge color="gray" variant="outline">Manual</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon component={Link} href={`/customers/${account.id}`} variant="light" color="blue" aria-label={`Open ${account.displayName}`}>
                      <IconArrowRight size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <Card withBorder radius="md" p="lg">
      <Group justify="space-between" mb="xs">
        <Text fw={600}>{label}</Text>
        {icon}
      </Group>
      <Title order={2}>{value}</Title>
    </Card>
  );
}
