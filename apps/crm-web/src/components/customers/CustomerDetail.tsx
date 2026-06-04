'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Drawer, Group, Loader, Menu, Paper, Progress, SimpleGrid, Stack, Tabs, Text, Title } from '@mantine/core';
import type { AccountDetail as AccountDetailRecord, TrainingCatalogResponse } from '@pulse/contracts';
import { EmptyStateMessage, WorkbenchHeader } from '@/components/ui/Workbench';
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
  const activePrimaryTab = resolveCustomerPrimaryTab(searchParams.get('tab'));
  const activeSecondaryPanel = resolveCustomerSecondaryPanel(searchParams.get('tab'), {
    canViewConsignment,
    canViewFinancials,
    canViewTraining,
  });
  const navigateToCustomerTab = (tab: CustomerTabValue) => {
    const next = new URLSearchParams(searchParams.toString());
    const queryValue = customerTabToQuery(tab);
    if (queryValue) {
      next.set('tab', queryValue);
    } else {
      next.delete('tab');
    }
    router.replace(`/customers/${accountId}${next.size ? `?${next.toString()}` : ''}`, { scroll: false });
  };

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

  return (
    <Stack gap="md">
      <WorkbenchHeader
        eyebrow="Account detail"
        title={account?.displayName ?? 'Customer Account'}
        description="Review next action, ownership, contacts, and locations from one profile."
        policyText="Related readiness, training, portal, consignment, activity, and finance context stay in More."
        secondaryActions={(
          <>
            <Text component={Link} href="/customers" size="sm" fw={700} c="blue" style={{ textDecoration: 'none' }}>
              Back to Accounts
            </Text>
            {account ? (
              <>
                <Badge color={account.lifecycleStatus === 'active' ? 'green' : account.lifecycleStatus === 'at_risk' ? 'yellow' : account.lifecycleStatus === 'inactive' ? 'gray' : 'red'} variant="light">
                  {account.lifecycleStatus === 'at_risk' ? 'At Risk' : account.lifecycleStatus.charAt(0).toUpperCase() + account.lifecycleStatus.slice(1)}
                </Badge>
                {!account.isActive ? <Badge color="gray" variant="outline">Record Inactive</Badge> : null}
              </>
            ) : null}
          </>
        )}
      />

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
          <AccountFocusPanel account={account} />
          <Tabs
            value={activePrimaryTab}
            onChange={(value) => {
              if (!value) return;
              navigateToCustomerTab(value as CustomerPrimaryTabValue);
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="overview">Profile</Tabs.Tab>
              <Tabs.Tab value="contacts">Contacts</Tabs.Tab>
              <Tabs.Tab value="locations">Locations</Tabs.Tab>
              <Menu position="bottom-start" withinPortal shadow="md" width={220}>
                <Menu.Target>
                  <Button variant={activeSecondaryPanel ? 'light' : 'subtle'} size="sm">
                    More
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => navigateToCustomerTab('readiness')}>Account readiness</Menu.Item>
                  {canViewConsignment ? <Menu.Item onClick={() => navigateToCustomerTab('consignment')}>Consignment</Menu.Item> : null}
                  {account.sourceLeadId ? (
                    <Menu.Item component={Link} href={`/leads/${account.sourceLeadId}`}>
                      View Source Lead
                    </Menu.Item>
                  ) : null}
                  <Menu.Item onClick={() => navigateToCustomerTab('activity-docs')}>Activity & Docs</Menu.Item>
                  {canViewFinancials ? <Menu.Item onClick={() => navigateToCustomerTab('payment-methods')}>Payment Methods</Menu.Item> : null}
                  {canViewTraining ? <Menu.Item onClick={() => navigateToCustomerTab('training')}>Training</Menu.Item> : null}
                  <Menu.Item onClick={() => navigateToCustomerTab('portal')}>Dealer Portal</Menu.Item>
                </Menu.Dropdown>
              </Menu>
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
          </Tabs>

          <Drawer
            opened={Boolean(activeSecondaryPanel)}
            onClose={() => navigateToCustomerTab('overview')}
            position="right"
            size="xl"
            title={activeSecondaryPanel ? customerSecondaryPanelTitle(activeSecondaryPanel) : 'Account details'}
          >
            <Stack gap="md">
              {activeSecondaryPanel === 'readiness' ? (
                <>
                  <AccountReadinessBrief account={account} />
                  <AccountUatHandoff account={account} />
                </>
              ) : null}
              {activeSecondaryPanel === 'consignment' && canViewConsignment ? (
                <CustomerConsignmentIndicator accountId={account.id} />
              ) : null}
              {activeSecondaryPanel === 'activity-docs' ? (
                <CustomerActivityDocs account={account} canViewFinancials={canViewFinancials} />
              ) : null}
              {activeSecondaryPanel === 'payment-methods' && canViewFinancials ? (
                <CustomerPaymentMethods accountId={account.id} canManage={canManageFinancials} />
              ) : null}
              {activeSecondaryPanel === 'training' && canViewTraining ? (
                <CustomerTrainingHistory
                  accountId={account.id}
                  accountName={account.displayName}
                  catalog={trainingCatalog}
                />
              ) : null}
              {activeSecondaryPanel === 'portal' ? (
                <CustomerDealerPortalAccess account={account} onProvisioned={() => void reloadAccount()} />
              ) : null}
            </Stack>
          </Drawer>
        </Stack>
      ) : null}
    </Stack>
  );
}

type CustomerPrimaryTabValue = 'overview' | 'contacts' | 'locations';
type CustomerSecondaryPanelValue = 'readiness' | 'consignment' | 'activity-docs' | 'payment-methods' | 'training' | 'portal';
type CustomerTabValue = CustomerPrimaryTabValue | CustomerSecondaryPanelValue;

function resolveCustomerPrimaryTab(requestedTab: string | null): CustomerPrimaryTabValue {
  if (requestedTab === 'contacts') return 'contacts';
  if (requestedTab === 'locations') return 'locations';
  return 'overview';
}

function resolveCustomerSecondaryPanel(
  requestedTab: string | null,
  permissions: { canViewConsignment: boolean; canViewFinancials: boolean; canViewTraining: boolean },
): CustomerSecondaryPanelValue | null {
  if (requestedTab === 'readiness' || requestedTab === 'account-readiness') return 'readiness';
  if (requestedTab === 'consignment' && permissions.canViewConsignment) return 'consignment';
  if (requestedTab === 'activity-docs' || requestedTab === 'activity' || requestedTab === 'documents') return 'activity-docs';
  if (requestedTab === 'portal' || requestedTab === 'dealer-portal') return 'portal';
  if ((requestedTab === 'payment-methods' || requestedTab === 'financials') && permissions.canViewFinancials) return 'payment-methods';
  if ((requestedTab === 'training' || requestedTab === 'training-history') && permissions.canViewTraining) return 'training';
  return null;
}

function customerTabToQuery(tab: CustomerTabValue) {
  return tab === 'overview' ? '' : tab;
}

function customerSecondaryPanelTitle(tab: CustomerSecondaryPanelValue) {
  switch (tab) {
    case 'readiness':
      return 'Account readiness';
    case 'consignment':
      return 'Consignment';
    case 'activity-docs':
      return 'Activity & Docs';
    case 'payment-methods':
      return 'Payment Methods';
    case 'training':
      return 'Training';
    case 'portal':
      return 'Dealer Portal';
  }
}

function AccountFocusPanel({ account }: { account: AccountDetailRecord }) {
  const primaryContact = account.contacts.find((contact) => contact.isPrimary) ?? account.contacts[0];
  const primaryLocation = account.locations.find((location) => location.isPrimary) ?? account.locations[0];
  const firstAttention = account.readiness.checks.find((check) => check.status === 'needs_attention');

  return (
    <Paper withBorder radius="md" p="lg">
      <Group justify="space-between" align="flex-start" mb="md">
        <Stack gap={4}>
          <Title order={3}>Today&apos;s Account Focus</Title>
          <Text size="sm" c="dimmed">
            Fast lane for account review: who to contact, where they operate, and what profile cleanup is next.
          </Text>
        </Stack>
        <Badge color={firstAttention ? 'yellow' : 'green'} variant="light">
          {firstAttention ? 'Follow-up needed' : 'Ready for review'}
        </Badge>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <FocusCard
          title="Who to contact"
          detail={primaryContact ? `${primaryContact.firstName} ${primaryContact.lastName}${primaryContact.email ? ` · ${primaryContact.email}` : ''}` : 'Contact pending.'}
          actionLabel={primaryContact ? 'Review contacts' : 'Add contact'}
          href={`/customers/${account.id}?tab=contacts`}
          tone={primaryContact ? 'ready' : 'attention'}
        />
        <FocusCard
          title="Where they operate"
          detail={primaryLocation ? [primaryLocation.city, primaryLocation.state, primaryLocation.countryCode].filter(Boolean).join(', ') || primaryLocation.name || 'Primary location saved.' : 'Location pending.'}
          actionLabel={primaryLocation ? 'Review locations' : 'Add location'}
          href={`/customers/${account.id}?tab=locations`}
          tone={primaryLocation ? 'ready' : 'attention'}
        />
        <FocusCard
          title="Profile readiness"
          detail={[
            account.territoryName ?? 'Territory pending',
            account.assignedTmName ?? 'TM pending',
            account.groupClassification ? formatDisplayValue(account.groupClassification) : 'Dealer group pending',
          ].join(' · ')}
          actionLabel="Review profile"
          href={`/customers/${account.id}`}
          tone={firstAttention ? 'attention' : 'ready'}
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

function CustomerActivityDocs({ account, canViewFinancials }: { account: AccountDetailRecord; canViewFinancials: boolean }) {
  const events = account.activityReview.recentEvents;
  const boundaries = account.activityReview.documentBoundaries.filter((boundary) => canViewFinancials || boundary.key !== 'payment_boundary');

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-start" mb="md">
          <Stack gap={4}>
            <Title order={3}>Activity & Document Review</Title>
            <Text size="sm" c="dimmed">
              Account activity and available documents for the team. Orders, invoices, shipments, revenue, and pricing stay in their approved systems until the service connection is live.
            </Text>
          </Stack>
          <Badge color={account.activityReview.parkedDependencies.length ? 'gray' : 'green'} variant="light">
            {account.activityReview.parkedDependencies.length ? `${account.activityReview.parkedDependencies.length} parked` : 'Clear'}
          </Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {boundaries.map((boundary) => (
            <Card key={boundary.key} withBorder radius="md" p="md">
              <Stack gap="xs">
                <Group justify="space-between" align="flex-start">
                  <Text fw={700}>{boundary.label}</Text>
                  <Badge color={documentBoundaryColor(boundary.status)} variant="light">
                    {formatDisplayValue(boundary.status)}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">{boundary.detail}</Text>
                {boundary.href ? (
                  <Button component={Link} href={boundary.href} variant="light" size="xs">
                    Open
                  </Button>
                ) : null}
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Paper>

      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-start" mb="md">
          <Stack gap={4}>
            <Title order={3}>Recent Account Activity</Title>
            <Text size="sm" c="dimmed">
              Account, contact, location, dealer access, payment, and source-lead updates captured for this profile.
            </Text>
          </Stack>
          <Badge color="blue" variant="light">{events.length}</Badge>
        </Group>
        <Stack gap="sm">
          {events.length ? events.map((event) => (
            <Card key={event.id} withBorder radius="md" p="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Group gap="xs">
                    <Badge color={activitySourceColor(event.source)} variant="light">{formatDisplayValue(event.source)}</Badge>
                    <Text fw={700}>{event.label}</Text>
                  </Group>
                  <Text size="sm" c="dimmed">{event.detail}</Text>
                  {event.actorName ? <Text size="xs" c="dimmed">By {event.actorName}</Text> : null}
                </Stack>
                <Text size="xs" c="dimmed">{formatShortDateTime(event.occurredAt)}</Text>
              </Group>
            </Card>
          )) : (
            <EmptyStateMessage
              title="No recent activity"
              description="Account, contact, location, portal, and payment updates will appear here after they are saved."
            />
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

function documentBoundaryColor(status: AccountDetailRecord['activityReview']['documentBoundaries'][number]['status']) {
  if (status === 'available') return 'green';
  if (status === 'needs_attention') return 'yellow';
  return 'gray';
}

function activitySourceColor(source: AccountDetailRecord['activityReview']['recentEvents'][number]['source']) {
  if (source === 'source_lead') return 'blue';
  if (source === 'payment_boundary') return 'grape';
  if (source === 'dealer_portal') return 'cyan';
  if (source === 'parked_dependency') return 'gray';
  return 'green';
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
    <Card
      component={Link}
      href={href}
      withBorder
      radius="md"
      p="md"
      style={{ textDecoration: 'none' }}
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={700}>{title}</Text>
          <Badge color={color} variant="light">{tone === 'parked' ? 'Parked' : tone === 'ready' ? 'Ready' : 'Check'}</Badge>
        </Group>
        <Text size="sm" c="dimmed" lineClamp={3}>{detail}</Text>
        <Text size="sm" fw={700} c="blue">
          {actionLabel}
        </Text>
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
            A quick Dynamic AQS checklist for using this account while external activity, pricing, orders, and invoices remain in their approved systems.
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
          empty="Completed handoff checks will appear here."
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

function formatShortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
