'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Anchor, Badge, Breadcrumbs, Button, Card, Group, Loader, Paper, Progress, SimpleGrid, Stack, Tabs, Text, Title } from '@mantine/core';
import type { AccountDetail as AccountDetailRecord, TrainingCatalogResponse } from '@pulse/contracts';
import { fetchAccountDetail, fetchTrainingCatalog } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';
import { CustomerDealerPortalAccess } from './CustomerDealerPortalAccess';
import { CustomerContacts } from './CustomerContacts';
import { CustomerLocations } from './CustomerLocations';
import { CustomerOverview } from './CustomerOverview';
import { CustomerPaymentMethods } from './CustomerPaymentMethods';
import { CustomerConsignmentIndicator } from '@/components/consignment/CustomerConsignmentIndicator';
import { CustomerTrainingHistory } from '@/components/training/CustomerTrainingHistory';
import { canAccessModule, canPerformAction } from '@/lib/access';

export function CustomerDetail({ accountId }: { accountId: string }) {
  const { auth, apiBaseUrl, isHydrated } = usePulseSession();
  const searchParams = useSearchParams();
  const accessToken = auth?.tokens.accessToken ?? '';
  const [account, setAccount] = useState<AccountDetailRecord | null>(null);
  const [trainingCatalog, setTrainingCatalog] = useState<TrainingCatalogResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canViewTraining = auth ? canAccessModule(auth.identity.role, 'training') : false;
  const canViewConsignment = auth ? canAccessModule(auth.identity.role, 'consignment') : false;
  const canEditCustomer = auth ? canPerformAction(auth.identity.role, 'customer.edit') : false;
  const canViewFinancials = auth ? canPerformAction(auth.identity.role, 'customer.financials_view') : false;
  const canManageFinancials = auth ? canPerformAction(auth.identity.role, 'customer.financials_manage') : false;
  const requestedTab = searchParams.get('tab');
  const defaultTab = requestedTab === 'training-history' && canViewTraining
    ? 'training'
    : requestedTab === 'payment-methods' && canViewFinancials
      ? 'payment-methods'
      : 'overview';

  const reloadAccount = async () => {
    if (!auth) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const next = await fetchAccountDetail(apiBaseUrl, accessToken, accountId);
      setAccount(next);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!auth) {
      setAccount(null);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [nextAccount, nextTrainingCatalog] = await Promise.all([
          fetchAccountDetail(apiBaseUrl, accessToken, accountId),
          canViewTraining ? fetchTrainingCatalog(apiBaseUrl, accessToken) : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setAccount(nextAccount);
          setTrainingCatalog(nextTrainingCatalog);
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

    return () => {
      cancelled = true;
    };
  }, [accessToken, accountId, apiBaseUrl, auth, canViewTraining]);

  if (!isHydrated) {
    return <Loader color="blue" />;
  }

  if (!auth) {
    return null;
  }

  const breadcrumbItems = [
    { title: 'Lead Hub', href: '/leads' },
    { title: 'Account Management', href: '/customers' },
    { title: account?.displayName ?? 'Account Detail', href: `/customers/${accountId}` },
  ].map((item) => (
    <Anchor component={Link} href={item.href} key={item.href} size="sm">
      {item.title}
    </Anchor>
  ));

  return (
    <Stack gap="md">
      <Breadcrumbs>{breadcrumbItems}</Breadcrumbs>

      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={1}>{account?.displayName ?? 'Customer Account'}</Title>
            <Text size="sm" c="dimmed">
              View the converted customer profile, territory ownership, source lead connection, and the first mapped contacts.
            </Text>
            {account ? (
              <Group gap="xs">
                <Badge color={account.lifecycleStatus === 'active' ? 'green' : account.lifecycleStatus === 'at_risk' ? 'yellow' : account.lifecycleStatus === 'inactive' ? 'gray' : 'red'} variant="light">
                  {account.lifecycleStatus === 'at_risk' ? 'At Risk' : account.lifecycleStatus.charAt(0).toUpperCase() + account.lifecycleStatus.slice(1)}
                </Badge>
                {!account.isActive ? <Badge color="gray" variant="outline">Record Inactive</Badge> : null}
              </Group>
            ) : null}
          </Stack>
          <Group gap="xs">
            <Button component={Link} href="/customers" variant="default">
              Back To Accounts
            </Button>
            {account?.sourceLeadId ? (
              <Button component={Link} href={`/leads/${account.sourceLeadId}`} variant="light">
                View Source Lead
              </Button>
            ) : null}
          </Group>
        </Group>
      </Paper>

      {errorMessage ? (
        <Alert color="red" variant="light">{errorMessage}</Alert>
      ) : null}

      {isLoading ? (
        <Card withBorder radius="md" p="xl">
          <Group justify="center">
            <Loader color="blue" />
          </Group>
        </Card>
      ) : null}

      {account ? (
        <Stack gap="md">
          <AccountReadinessBrief account={account} />
          {canViewConsignment ? <CustomerConsignmentIndicator accountId={account.id} /> : null}
          <Tabs defaultValue={defaultTab}>
            <Tabs.List>
              <Tabs.Tab value="overview">Profile</Tabs.Tab>
              <Tabs.Tab value="contacts">Contacts</Tabs.Tab>
              <Tabs.Tab value="locations">Locations</Tabs.Tab>
              {canViewFinancials ? <Tabs.Tab value="payment-methods">Payment Methods</Tabs.Tab> : null}
              {canViewTraining ? <Tabs.Tab value="training">Training</Tabs.Tab> : null}
              <Tabs.Tab value="portal">Dealer Portal</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="overview" pt="md">
              <CustomerOverview account={account} onUpdated={reloadAccount} canEdit={canEditCustomer} />
            </Tabs.Panel>
            <Tabs.Panel value="contacts" pt="md">
              <CustomerContacts account={account} onUpdated={reloadAccount} canEdit={canEditCustomer} />
            </Tabs.Panel>
            <Tabs.Panel value="locations" pt="md">
              <CustomerLocations account={account} onUpdated={reloadAccount} canEdit={canEditCustomer} />
            </Tabs.Panel>
            {canViewFinancials ? (
              <Tabs.Panel value="payment-methods" pt="md">
                <CustomerPaymentMethods accountId={account.id} canManage={canManageFinancials} />
              </Tabs.Panel>
            ) : null}
            {canViewTraining ? (
              <Tabs.Panel value="training" pt="md">
                <CustomerTrainingHistory
                  accountId={account.id}
                  accountName={account.displayName}
                  catalog={trainingCatalog}
                />
              </Tabs.Panel>
            ) : null}
            <Tabs.Panel value="portal" pt="md">
              <CustomerDealerPortalAccess account={account} onProvisioned={() => void reloadAccount()} />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      ) : null}
    </Stack>
  );
}

function AccountReadinessBrief({ account }: { account: AccountDetailRecord }) {
  const attentionCount = account.readiness.checks.filter((check) => check.status === 'needs_attention').length;
  const parkedCount = account.readiness.checks.filter((check) => check.status === 'parked').length;
  const keyChecks = account.readiness.checks.filter((check) => ['territory', 'dealer_membership', 'source_lineage', 'erp_activity'].includes(check.key));

  return (
    <Paper withBorder radius="md" p="lg">
      <Group justify="space-between" align="flex-start" mb="md">
        <Stack gap={4}>
          <Group gap="xs">
            <Title order={3}>Account Readiness</Title>
            <Badge color={readinessColor(account.readiness.status)} variant="light">
              {formatReadinessStatus(account.readiness.status)}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            One place to confirm the account is ready for territory handoff, dealer catalog visibility, training, and support work.
          </Text>
        </Stack>
        <Stack gap={4} align="flex-end">
          <Text fw={700} size="xl">{account.readiness.score}%</Text>
          <Text size="xs" c="dimmed">{attentionCount} needs attention · {parkedCount} parked</Text>
        </Stack>
      </Group>
      <Progress value={account.readiness.score} color={readinessColor(account.readiness.status)} mb="md" />
      <SimpleGrid cols={{ base: 1, md: 4 }}>
        {keyChecks.map((check) => (
          <Card key={check.key} withBorder radius="md" p="md">
            <Stack gap={6}>
              <Group justify="space-between" align="flex-start">
                <Text fw={700}>{check.label}</Text>
                <Badge color={readinessColor(check.status)} variant="light" size="sm">
                  {formatReadinessStatus(check.status)}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">{check.message}</Text>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Paper>
  );
}

function readinessColor(status: AccountDetailRecord['readiness']['status']) {
  switch (status) {
    case 'ready':
      return 'green';
    case 'needs_attention':
      return 'yellow';
    case 'parked':
      return 'gray';
  }
}

function formatReadinessStatus(status: AccountDetailRecord['readiness']['status']) {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'needs_attention':
      return 'Needs Attention';
    case 'parked':
      return 'Parked';
  }
}
