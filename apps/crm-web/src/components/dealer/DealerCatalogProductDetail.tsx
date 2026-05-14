'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, Divider, Grid, Group, SimpleGrid, Stack, Text, Title, Tooltip } from '@mantine/core';
import type { DealerPortalCatalogAssetSummary, DealerPortalCatalogProductSummary } from '@pulse/contracts';
import { IconArrowLeft, IconDownload, IconFileDescription, IconFolder, IconInfoCircle, IconStar, IconStarFilled, IconTag } from '@tabler/icons-react';
import type { DealerCatalogAssetActions, DealerCatalogFavoriteActions } from '@/components/dealer/DealerCatalog';

type DealerCatalogProductWithFavorites = DealerPortalCatalogProductSummary & {
  isFavorite?: boolean;
};

type CatalogViewContext = {
  name?: string;
  brandLabel?: string;
  regionScope?: string;
};

export function DealerCatalogProductDetail({
  assetActions,
  catalogView,
  favoriteActions,
  product,
}: {
  assetActions?: DealerCatalogAssetActions | undefined;
  catalogView?: CatalogViewContext | undefined;
  favoriteActions?: DealerCatalogFavoriteActions | undefined;
  product: DealerCatalogProductWithFavorites;
}) {
  const fileGroups = useMemo(() => groupAssetsByRole(product.assets), [product.assets]);
  const isFavorite = Boolean(product.isFavorite);
  const canToggleFavorite = Boolean(favoriteActions?.isAvailable && favoriteActions.toggleFavorite);

  return (
    <Stack gap="lg">
      <Card withBorder radius="xl" p="lg" className="premium-hero-panel">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={8}>
              <Button component={Link} href="/dealer/catalog" variant="subtle" size="xs" leftSection={<IconArrowLeft size={14} />}>
                Back To Catalog
              </Button>
              <Group gap="xs">
                <Badge color="gray" variant="light">
                  {product.sku}
                </Badge>
                {product.categoryName ? (
                  <Badge color="blue" variant="light">
                    {product.categoryName}
                  </Badge>
                ) : null}
                {product.familyName ? (
                  <Badge color="cyan" variant="light">
                    {product.familyName}
                  </Badge>
                ) : null}
                {product.brandLabel ? (
                  <Badge color="green" variant="light" leftSection={<IconTag size={12} />}>
                    {product.brandLabel}
                  </Badge>
                ) : null}
              </Group>
              <Title order={1}>{product.displayName}</Title>
              {product.shortDescription ? (
                <Text c="dimmed" maw={820}>
                  {product.shortDescription}
                </Text>
              ) : null}
            </Stack>
            <Stack gap="xs" align="flex-end">
              <Tooltip label={canToggleFavorite ? (isFavorite ? 'Remove favorite' : 'Save favorite') : 'Favorite status'}>
                <Button
                  variant={isFavorite ? 'light' : 'default'}
                  color={isFavorite ? 'yellow' : 'blue'}
                  leftSection={isFavorite ? <IconStarFilled size={16} /> : <IconStar size={16} />}
                  disabled={!canToggleFavorite || favoriteActions?.updatingPresentationId === product.presentationId}
                  onClick={() => {
                    if (favoriteActions?.toggleFavorite) {
                      void favoriteActions.toggleFavorite(product);
                    }
                  }}
                >
                  {isFavorite ? 'Saved' : 'Save'}
                </Button>
              </Tooltip>
              {product.favoriteCount > 0 ? (
                <Text size="xs" c="dimmed">
                  {product.favoriteCount} saved
                </Text>
              ) : null}
            </Stack>
          </Group>
        </Stack>
      </Card>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="lg">
            <Card withBorder radius="xl" p="lg" className="premium-detail-card">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Text className="eyebrow">Product Overview</Text>
                    <Title order={3}>Dealer-facing details</Title>
                  </Stack>
                  <Badge color="green" variant="light">
                    Published
                  </Badge>
                </Group>
                {product.longDescription ? (
                  <Text>{product.longDescription}</Text>
                ) : product.shortDescription ? (
                  <Text>{product.shortDescription}</Text>
                ) : (
                  <Text c="dimmed">No additional description has been published for this product yet.</Text>
                )}
                {product.specSummary ? (
                  <>
                    <Divider />
                    <Stack gap={4}>
                      <Text fw={700}>Specification Summary</Text>
                      <Text size="sm">{product.specSummary}</Text>
                    </Stack>
                  </>
                ) : null}
              </Stack>
            </Card>

            <Card withBorder radius="xl" p="lg" className="premium-detail-card">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Text className="eyebrow">File Pack</Text>
                    <Title order={3}>Product files</Title>
                    <Text size="sm" c="dimmed">
                      These are the files Dynamic AQS has published for this product.
                    </Text>
                  </Stack>
                  <Badge color="blue" variant="light">
                    {product.assets.length} file{product.assets.length === 1 ? '' : 's'}
                  </Badge>
                </Group>

                {product.assets.length === 0 ? (
                  <Alert color="yellow" variant="light">
                    No files are attached yet.
                  </Alert>
                ) : (
                  <Stack gap="md">
                    {fileGroups.map((group) => (
                      <Stack key={group.role} gap="sm">
                        <Group gap="xs">
                          <IconFolder size={18} />
                          <Text fw={700}>{formatAssetRole(group.role)}</Text>
                          <Badge size="sm" color="gray" variant="light">
                            {group.assets.length}
                          </Badge>
                        </Group>
                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                          {group.assets.map((asset) => (
                            <AssetFileCard
                              key={`${asset.id}-${asset.role}`}
                              asset={asset}
                              assetActions={assetActions}
                              product={product}
                            />
                          ))}
                        </SimpleGrid>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="lg">
            <Card withBorder radius="xl" p="lg" className="premium-subhero-panel">
              <Stack gap="sm">
                <Text className="eyebrow">Catalog Context</Text>
                <Title order={3}>Who sees this</Title>
                <MetadataRow label="Catalog View" value={catalogView?.name ?? 'Assigned dealer catalog'} />
                <MetadataRow label="Brand" value={product.brandLabel ?? catalogView?.brandLabel ?? 'Standard'} />
                <MetadataRow label="Region" value={product.regionScope ?? catalogView?.regionScope ?? 'Account default'} />
                <MetadataRow label="Category" value={product.categoryName ?? 'Uncategorized'} />
                <MetadataRow label="Family" value={product.familyName ?? 'No family assigned'} />
              </Stack>
            </Card>

            <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
              Prices, stock, cart, order submit, invoices, payments, and credit status will appear after the approved
              order and finance connections are live.
            </Alert>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

function AssetFileCard({
  asset,
  assetActions,
  product,
}: {
  asset: DealerPortalCatalogAssetSummary;
  assetActions?: DealerCatalogAssetActions | undefined;
  product: DealerCatalogProductWithFavorites;
}) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={2}>
            <Group gap="xs" wrap="nowrap">
              <IconFileDescription size={18} />
              <Text fw={700}>{asset.title}</Text>
            </Group>
            <Text size="xs" c="dimmed">
              {[formatAssetRole(asset.role), asset.fileName, asset.kind.replace(/_/g, ' ')].filter(Boolean).join(' / ')}
            </Text>
          </Stack>
          <Badge size="sm" color={asset.visibility === 'public' ? 'green' : 'blue'} variant="light">
            {asset.visibility === 'public' ? 'Public' : 'Dealer'}
          </Badge>
        </Group>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconDownload size={14} />}
          disabled={!asset.downloadUrl}
          loading={assetActions?.openingAssetId === asset.id}
          onClick={() => {
            if (assetActions?.openAsset) {
              void assetActions.openAsset(asset, product);
              return;
            }
            if (asset.downloadUrl) {
              window.open(asset.downloadUrl, '_blank', 'noopener,noreferrer');
            }
          }}
        >
          Open File
        </Button>
      </Stack>
    </Card>
  );
}

function groupAssetsByRole(assets: DealerPortalCatalogAssetSummary[]) {
  const groups = new Map<string, DealerPortalCatalogAssetSummary[]>();
  for (const asset of assets) {
    groups.set(asset.role, [...(groups.get(asset.role) ?? []), asset]);
  }

  return Array.from(groups.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([role, groupedAssets]) => ({
      role,
      assets: groupedAssets,
    }));
}

function formatAssetRole(role: string) {
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="md" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={700} ta="right">
        {value}
      </Text>
    </Group>
  );
}
