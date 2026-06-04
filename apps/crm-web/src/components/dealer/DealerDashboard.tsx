'use client';

import Link from 'next/link';
import { Alert, Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import type {
  DealerPortalAccessRoleKey,
  DealerPortalCatalogAssetSummary,
  DealerPortalCatalogProductSummary,
  DealerPortalDashboardResponse,
} from '@pulse/contracts';
import { IconArrowRight, IconDownload, IconShieldCheck } from '@tabler/icons-react';
import { useDealerPortalCatalog } from '@/lib/use-dealer-portal-catalog';

export function DealerDashboard({ dashboard }: { dashboard: DealerPortalDashboardResponse }) {
  const primaryContact = dashboard.contacts.find((contact) => contact.isPrimary) ?? dashboard.contacts[0] ?? null;
  const primaryLocation = dashboard.locations.find((location) => location.isPrimary) ?? dashboard.locations[0] ?? null;
  const roleProfile = getRoleProfile(dashboard.currentUser.accessRole);
  const { assetActions, catalog, isLoading: isCatalogLoading } = useDealerPortalCatalog();
  const primaryCta = roleProfile.link ?? { href: '/dealer/catalog', label: 'Browse Products & Files', variant: 'filled' as const };
  const hasProfileGaps = dashboard.contacts.length === 0 || dashboard.locations.length === 0;
  const recentFiles = buildRecentFileRows(catalog?.products ?? []);
  const availableFileCount = catalog?.products.reduce((total, product) => total + product.assets.filter((asset) => Boolean(asset.downloadUrl)).length, 0) ?? 0;

  return (
    <Stack gap="lg">
      <Card withBorder radius="xl" p="lg" className="premium-hero-panel">
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Text className="eyebrow">Dealer Portal</Text>
            <Title order={1}>Start Here</Title>
            <Text c="dimmed" maw={760}>
              Open available files, check who to contact, or review your company portal access.
            </Text>
          </Stack>
          <Group gap="sm">
            <Button component={Link} href={primaryCta.href} variant={primaryCta.variant}>
              {primaryCta.label}
            </Button>
          </Group>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
        <Card withBorder radius="xl" p="lg" className="premium-detail-card">
          <Stack gap="md" h="100%">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Text className="eyebrow">Next Action</Text>
                <Title order={3}>{roleProfile.sectionTitle}</Title>
              </Stack>
              <Badge color={roleProfile.color} variant="light">
                {roleProfile.badge}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {roleProfile.priority}
            </Text>
            <Button component={Link} href={primaryCta.href} variant={primaryCta.variant} rightSection={<IconArrowRight size={16} />}>
              {primaryCta.label}
            </Button>
          </Stack>
        </Card>

        <Card withBorder radius="xl" p="lg" className="premium-detail-card">
          <Stack gap="md" h="100%">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Text className="eyebrow">Account Support</Text>
                <Title order={3}>Who to contact</Title>
              </Stack>
              <IconShieldCheck size={22} color="var(--mantine-color-blue-6)" />
            </Group>
            <Stack gap={8}>
              <MetadataRow label="Primary Contact" value={primaryContact?.displayName ?? 'Dynamic AQS support'} />
              <MetadataRow label="Location" value={primaryLocation ? [primaryLocation.city, primaryLocation.state].filter(Boolean).join(', ') || primaryLocation.name : 'Not available yet'} />
              <MetadataRow label="Territory Manager" value={dashboard.portalAccount.assignedTmName ?? 'Dynamic AQS support'} />
            </Stack>
            <Button component={Link} href="/dealer/account#account-health" variant="light">
              Account Health
            </Button>
          </Stack>
        </Card>

        <Card withBorder radius="xl" p="lg" className="premium-detail-card">
          <Stack gap="md" h="100%">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Text className="eyebrow">Product Files</Text>
                <Title order={3}>Ready to open</Title>
              </Stack>
              <Badge color="green" variant="light">
                {availableFileCount} file{availableFileCount === 1 ? '' : 's'}
              </Badge>
            </Group>
            {isCatalogLoading ? (
              <Text size="sm" c="dimmed">
                Loading available files...
              </Text>
            ) : recentFiles.length > 0 ? (
              <Stack gap="xs">
                {recentFiles.map((file) => (
                  <Group key={`${file.product.presentationId}-${file.asset.id}`} justify="space-between" gap="sm" wrap="nowrap">
                    <Stack gap={0}>
                      <Text size="sm" fw={600} lineClamp={1}>
                        {file.asset.title}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {file.product.displayName}
                      </Text>
                    </Stack>
                    <Button
                      size="compact-xs"
                      variant="light"
                      leftSection={<IconDownload size={13} />}
                      loading={assetActions.openingAssetId === file.asset.id}
                      onClick={() => {
                        if (assetActions.openAsset) {
                          void assetActions.openAsset(file.asset, file.product);
                          return;
                        }
                        if (file.asset.downloadUrl) {
                          window.open(file.asset.downloadUrl, '_blank', 'noopener,noreferrer');
                        }
                      }}
                    >
                      Open
                    </Button>
                  </Group>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                No files are available for this company right now. Contact Dynamic AQS support if you need a specific file.
              </Text>
            )}
            <Button component={Link} href="/dealer/catalog" variant="default">
              View All Products & Files
            </Button>
          </Stack>
        </Card>
      </SimpleGrid>

      {hasProfileGaps ? (
        <Alert color="blue" variant="light">
          Account profile setup is still being completed. Contact and location details appear in Account Center once Dynamic AQS makes them available for this company.
        </Alert>
      ) : null}
    </Stack>
  );
}

type RoleProfile = {
  label: string;
  badge: string;
  color: string;
  priority: string;
  sectionTitle: string;
  link?: {
    href: string;
    label: string;
    variant: 'filled' | 'light' | 'default';
  };
};

function getRoleProfile(role: DealerPortalAccessRoleKey): RoleProfile {
  const profiles: Record<DealerPortalAccessRoleKey, RoleProfile> = {
    admin: {
      label: 'Account Access',
      badge: 'User access',
      color: 'blue',
      priority: 'Start with company users, access, contacts, and company details.',
      sectionTitle: 'Account users and access',
      link: { href: '/dealer/account', label: 'Open Account Center', variant: 'filled' },
    },
    purchasing: {
      label: 'Products & Files',
      badge: 'Products and files',
      color: 'green',
      priority: 'Browse products and files available for your company.',
      sectionTitle: 'Products and files',
      link: { href: '/dealer/catalog', label: 'Browse Products & Files', variant: 'filled' },
    },
    accounting: {
      label: 'Account Health',
      badge: 'Account health',
      color: 'orange',
      priority: 'Start with Account Health for account profile and support status.',
      sectionTitle: 'Account Health',
      link: { href: '/dealer/account#account-health', label: 'Account Health', variant: 'filled' },
    },
    viewer: {
      label: 'Viewer',
      badge: 'Read-only',
      color: 'gray',
      priority: 'Use the portal as a read-only reference for company, location, contact, product, and file details.',
      sectionTitle: 'Read-only portal view',
      link: { href: '/dealer/catalog', label: 'Browse Products & Files', variant: 'filled' },
    },
  };

  return profiles[role];
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500} ta="right" maw={260}>
        {value}
      </Text>
    </Group>
  );
}

function buildRecentFileRows(products: DealerPortalCatalogProductSummary[]) {
  const rows: Array<{
    asset: DealerPortalCatalogAssetSummary;
    product: DealerPortalCatalogProductSummary;
  }> = [];

  for (const product of products) {
    for (const asset of product.assets) {
      if (!asset.downloadUrl) {
        continue;
      }
      rows.push({ asset, product });
      if (rows.length >= 3) {
        return rows;
      }
    }
  }

  return rows;
}
