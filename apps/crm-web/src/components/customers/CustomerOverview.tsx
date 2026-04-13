'use client';

import Link from 'next/link';
import { Badge, Button, Card, Grid, Group, List, Stack, Text, Title } from '@mantine/core';
import type { AccountDetail } from '@pulse/contracts';

export function CustomerOverview({ account }: { account: AccountDetail }) {
  const activeLocations = account.locations.filter((location) => location.isActive);
  const primaryLocation = activeLocations.find((location) => location.isPrimary) ?? activeLocations[0];

  return (
    <Stack gap="lg">
      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="md" p="lg">
            <Stack gap="xs">
              <Title order={4}>Account Snapshot</Title>
              <MetadataRow label="Display Name" value={account.displayName} />
              <MetadataRow label="Legal Name" value={account.legalName ?? 'Not provided'} />
              <MetadataRow label="Account Type" value={account.accountType ?? 'Not classified'} />
              <MetadataRow label="Status" value={account.isActive ? 'Active' : 'Inactive'} />
              <MetadataRow label="Primary Location" value={formatLocation(primaryLocation)} />
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="md" p="lg">
            <Stack gap="xs">
              <Title order={4}>Territory Ownership</Title>
              <MetadataRow label="Territory" value={account.territoryName ?? 'Not assigned'} />
              <MetadataRow label="Region" value={account.regionName ?? 'Not assigned'} />
              <MetadataRow label="Shipping Center" value={account.shippingCenterName ?? 'Not assigned'} />
              <MetadataRow label="TM" value={account.assignedTmName ?? 'Not assigned'} />
              <MetadataRow label="RD" value={account.assignedRdName ?? 'Not assigned'} />
              <MetadataRow label="Assignment Method" value={formatAssignmentMethod(account.territoryAssignmentMethod)} />
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Title order={4}>Account Lifecycle</Title>
          {account.sourceLeadId ? (
            <Button component={Link} href={`/leads/${account.sourceLeadId}`} variant="light" size="xs">
              View Source Lead
            </Button>
          ) : null}
        </Group>
        <Group gap="xs" mb="md">
          <Badge color="blue" variant="light">{account.contactCount} Contacts</Badge>
          <Badge color="cyan" variant="light">{account.locationCount} Locations</Badge>
          {account.territoryCode ? <Badge color="grape" variant="light">{account.territoryCode}</Badge> : null}
          {account.shippingCenterCode ? <Badge color="teal" variant="light">{account.shippingCenterCode}</Badge> : null}
        </Group>
        <List spacing="xs" size="sm">
          <List.Item>Customer activation now lives in Pulse from lead conversion through first-order confirmation.</List.Item>
          <List.Item>Account territory was carried from the lead routing decision so downstream views stay aligned.</List.Item>
          <List.Item>Further ERP-driven order, pricing, and financial detail will layer here after the Acumatica boundary is wired.</List.Item>
        </List>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Title order={4} mb="md">Locations</Title>
        <Stack gap="sm">
          {account.locations.length === 0 ? (
            <Text size="sm" c="dimmed">No account locations have been created yet.</Text>
          ) : account.locations.map((location) => (
            <Card key={location.id} withBorder radius="md" p="md">
              <Group justify="space-between" mb="xs">
                <Text fw={600}>{location.name ?? location.locationCode ?? 'Location'}</Text>
                <Group gap="xs">
                  {location.isPrimary ? <Badge color="blue" variant="light">Primary</Badge> : null}
                  <Badge color={location.isActive ? 'green' : 'gray'} variant="outline">
                    {location.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Group>
              </Group>
              <Text size="sm" c="dimmed">{formatLocation(location)}</Text>
            </Card>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start" gap="md">
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="sm" fw={500} ta="right">{value}</Text>
    </Group>
  );
}

function formatLocation(location: AccountDetail['locations'][number] | undefined) {
  if (!location) {
    return 'Not provided';
  }

  return [
    location.line1,
    location.city,
    location.state,
    location.postalCode,
    location.countryCode,
  ].filter(Boolean).join(', ') || 'Not provided';
}

function formatAssignmentMethod(value: AccountDetail['territoryAssignmentMethod']) {
  switch (value) {
    case 'default_state':
      return 'Default State';
    case 'manual_override':
      return 'Manual Override';
    case 'system':
      return 'System';
    default:
      return 'Not recorded';
  }
}
