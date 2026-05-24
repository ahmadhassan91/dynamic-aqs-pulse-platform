'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const router = useRouter();
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
  const activeTab = resolveCustomerTab(searchParams.get('tab'), { canViewFinancials, canViewTraining });

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
          <AccountUatHandoff account={account} />
          <AccountFocusPanel account={account} canViewFinancials={canViewFinancials} />
          {canViewConsignment ? <CustomerConsignmentIndicator accountId={account.id} /> : null}
          <Tabs
            value={activeTab}
            onChange={(value) => {
              if (!value) return;
              const next = new URLSearchParams(searchParams.toString());
              const queryValue = customerTabToQuery(value as CustomerTabValue);
              if (queryValue) {
                next.set('tab', queryValue);
              } else {
                next.delete('tab');
              }
              router.replace(`/customers/${accountId}${next.size ? `?${next.toString()}` : ''}`, { scroll: false });
            }}
          >
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

type CustomerTabValue = 'overview' | 'contacts' | 'locations' | 'payment-methods' | 'training' | 'portal';

function resolveCustomerTab(
  requestedTab: string | null,
  permissions: { canViewFinancials: boolean; canViewTraining: boolean },
): CustomerTabValue {
  if (requestedTab === 'contacts') return 'contacts';
  if (requestedTab === 'locations') return 'locations';
  if (requestedTab === 'portal' || requestedTab === 'dealer-portal') return 'portal';
  if ((requestedTab === 'payment-methods' || requestedTab === 'financials') && permissions.canViewFinancials) return 'payment-methods';
  if ((requestedTab === 'training' || requestedTab === 'training-history') && permissions.canViewTraining) return 'training';
  return 'overview';
}

function customerTabToQuery(tab: CustomerTabValue) {
  return tab === 'overview' ? '' : tab;
}

function AccountFocusPanel({ account, canViewFinancials }: { account: AccountDetailRecord; canViewFinancials: boolean }) {
  const primaryContact = account.contacts.find((contact) => contact.isPrimary) ?? account.contacts[0];
  const primaryLocation = account.locations.find((location) => location.isPrimary) ?? account.locations[0];
  const firstAttention = account.readiness.checks.find((check) => check.status === 'needs_attention');
  const erpCheck = account.readiness.checks.find((check) => check.key === 'erp_activity');

  return (
    <Paper withBorder radius="md" p="lg">
      <Group justify="space-between" align="flex-start" mb="md">
        <Stack gap={4}>
          <Title order={3}>Today&apos;s Account Focus</Title>
          <Text size="sm" c="dimmed">
            Fast lane for account review: contact, location, territory/dealer context, and parked ERP truth in one pass.
          </Text>
        </Stack>
        <Badge color={firstAttention ? 'yellow' : 'green'} variant="light">
          {firstAttention ? 'Follow-up needed' : 'Ready for UAT'}
        </Badge>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 4 }}>
        <FocusCard
          title="Who to contact"
          detail={primaryContact ? `${primaryContact.firstName} ${primaryContact.lastName}${primaryContact.email ? ` · ${primaryContact.email}` : ''}` : 'No contact saved yet.'}
          actionLabel={primaryContact ? 'Review contacts' : 'Add contact'}
          href={`/customers/${account.id}?tab=contacts`}
          tone={primaryContact ? 'ready' : 'attention'}
        />
        <FocusCard
          title="Where they operate"
          detail={primaryLocation ? [primaryLocation.city, primaryLocation.state, primaryLocation.countryCode].filter(Boolean).join(', ') || primaryLocation.name || 'Primary location saved.' : 'No location saved yet.'}
          actionLabel={primaryLocation ? 'Review locations' : 'Add location'}
          href={`/customers/${account.id}?tab=locations`}
          tone={primaryLocation ? 'ready' : 'attention'}
        />
        <FocusCard
          title="Dealer visibility"
          detail={[
            account.groupClassification ? formatDisplayValue(account.groupClassification) : 'Group classification pending',
            account.regionName ?? account.regionCode,
          ].filter(Boolean).join(' · ')}
          actionLabel="Preview portal"
          href={`/customers/${account.id}?tab=portal`}
          tone={account.groupClassification ? 'ready' : 'attention'}
        />
        <FocusCard
          title="ERP boundary"
          detail={erpCheck?.message ?? 'Orders, invoices, pricing, and revenue activity stay parked until Acumatica is connected.'}
          actionLabel={canViewFinancials ? 'Review payment boundary' : 'Review profile'}
          href={`/customers/${account.id}?tab=${canViewFinancials ? 'payment-methods' : 'overview'}`}
          tone="parked"
        />
      </SimpleGrid>
      {firstAttention ? (
        <Alert color="yellow" variant="light" mt="md">
          {firstAttention.message}
        </Alert>
      ) : null}
    </Paper>
  );
}

function FocusCard({
  actionLabel,
  detail,
  href,
  title,
  tone,
}: {
  actionLabel: string;
  detail: string;
  href: string;
  title: string;
  tone: 'ready' | 'attention' | 'parked';
}) {
  const color = tone === 'ready' ? 'green' : tone === 'attention' ? 'yellow' : 'gray';
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={700}>{title}</Text>
          <Badge color={color} variant="light">{tone === 'parked' ? 'Parked' : tone === 'ready' ? 'Ready' : 'Check'}</Badge>
        </Group>
        <Text size="sm" c="dimmed" lineClamp={3}>{detail}</Text>
        <Button component={Link} href={href} variant="light" size="xs">
          {actionLabel}
        </Button>
      </Stack>
    </Card>
  );
}

function AccountUatHandoff({ account }: { account: AccountDetailRecord }) {
  const needsAttention = account.readiness.checks.filter((check) => check.status === 'needs_attention');
  const parked = account.readiness.checks.filter((check) => check.status === 'parked');
  const ready = account.readiness.checks.filter((check) => check.status === 'ready');

  return (
    <Paper withBorder radius="md" p="lg">
      <Group justify="space-between" align="flex-start" mb="md">
        <Stack gap={4}>
          <Title order={3}>Day-One Handoff</Title>
          <Text size="sm" c="dimmed">
            A quick Dynamic AQS checklist for using this account before ERP activity, pricing, orders, and invoices are connected.
          </Text>
        </Stack>
        <Badge color={needsAttention.length ? 'yellow' : 'green'} variant="light">
          {needsAttention.length ? `${needsAttention.length} action${needsAttention.length === 1 ? '' : 's'}` : 'Usable now'}
        </Badge>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <HandoffCard
          title="Ready now"
          tone="ready"
          items={ready.slice(0, 4).map((check) => check.label)}
          empty="No completed handoff checks yet."
        />
        <HandoffCard
          title="Needs team follow-up"
          tone="attention"
          items={needsAttention.map((check) => check.message)}
          empty="No Pulse-owned follow-up is blocking this account."
        />
        <HandoffCard
          title="Parked dependency"
          tone="parked"
          items={parked.map((check) => check.message)}
          empty="No external dependency is currently parked."
        />
      </SimpleGrid>
    </Paper>
  );
}

function HandoffCard({
  empty,
  items,
  title,
  tone,
}: {
  empty: string;
  items: string[];
  title: string;
  tone: 'ready' | 'attention' | 'parked';
}) {
  const color = tone === 'ready' ? 'green' : tone === 'attention' ? 'yellow' : 'gray';
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={700}>{title}</Text>
          <Badge color={color} variant="light">{items.length}</Badge>
        </Group>
        {items.length ? items.map((item) => (
          <Text key={item} size="sm" c="dimmed">
            {item}
          </Text>
        )) : (
          <Text size="sm" c="dimmed">{empty}</Text>
        )}
      </Stack>
    </Card>
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

function formatDisplayValue(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
