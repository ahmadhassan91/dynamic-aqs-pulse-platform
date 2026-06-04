'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Anchor, Badge, Button, Card, Collapse, Group, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import type { DealerPortalCatalogAssetSummary, DealerPortalCatalogResponse, DealerPortalCatalogProductSummary } from '@pulse/contracts';
import { IconArrowRight, IconDownload, IconFile, IconFilter, IconPackage, IconSearch, IconStar, IconStarFilled } from '@tabler/icons-react';

type DealerCatalogProductWithFavorites = DealerPortalCatalogProductSummary & {
  isFavorite?: boolean;
};

type DealerCatalogResponseWithFavorites = Omit<DealerPortalCatalogResponse, 'products'> & {
  products: DealerCatalogProductWithFavorites[];
};

type FileAvailabilityFilter = 'all' | 'with_files' | 'without_files';

export interface DealerCatalogFavoriteActions {
  isAvailable: boolean;
  updatingPresentationId?: string | undefined;
  toggleFavorite?: (product: DealerCatalogProductWithFavorites) => void | Promise<void>;
}

export interface DealerCatalogAssetActions {
  openingAssetId?: string | undefined;
  openAsset?: (asset: DealerPortalCatalogAssetSummary, product: DealerCatalogProductWithFavorites) => void | Promise<void>;
}

const uncategorizedFilterValue = '__uncategorized__';

export function DealerCatalog({
  assetActions,
  catalog,
  favoriteActions,
}: {
  catalog: DealerPortalCatalogResponse;
  assetActions?: DealerCatalogAssetActions | undefined;
  favoriteActions?: DealerCatalogFavoriteActions | undefined;
}) {
  const catalogWithFavorites = catalog as DealerCatalogResponseWithFavorites;
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [fileFilter, setFileFilter] = useState<FileAvailabilityFilter>('all');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    let hasUncategorized = false;

    for (const product of catalogWithFavorites.products) {
      if (product.categoryName) {
        categories.add(product.categoryName);
      } else {
        hasUncategorized = true;
      }
    }

    return [
      { value: 'all', label: 'All categories' },
      ...Array.from(categories)
        .sort((first, second) => first.localeCompare(second))
        .map((category) => ({ value: category, label: category })),
      ...(hasUncategorized ? [{ value: uncategorizedFilterValue, label: 'Uncategorized' }] : []),
    ];
  }, [catalogWithFavorites.products]);

  const brandOptions = useMemo(() => buildProductOptionList(catalogWithFavorites.products, (product) => product.brandLabel, 'All brands'), [catalogWithFavorites.products]);
  const familyOptions = useMemo(() => buildProductOptionList(catalogWithFavorites.products, (product) => product.familyName, 'All families'), [catalogWithFavorites.products]);
  const fileTypeOptions = useMemo(() => {
    const kinds = new Set(catalogWithFavorites.products.flatMap((product) => product.assets.filter((asset) => Boolean(asset.downloadUrl)).map((asset) => asset.kind)));
    return [
      { value: 'all', label: 'All file types' },
      ...Array.from(kinds)
        .sort((first, second) => first.localeCompare(second))
        .map((kind) => ({ value: kind, label: kind.replace(/_/g, ' ') })),
    ];
  }, [catalogWithFavorites.products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return catalogWithFavorites.products.filter((product) => {
      const matchesSearch = normalizedSearch
        ? [
            product.sku,
            product.displayName,
            product.shortDescription,
            product.longDescription,
            product.categoryName,
            product.familyName,
            ...product.assets.filter((asset) => Boolean(asset.downloadUrl)).flatMap((asset) => [asset.title, asset.fileName, asset.role]),
          ]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(normalizedSearch))
        : true;

      const matchesCategory = categoryFilter === 'all'
        || (categoryFilter === uncategorizedFilterValue ? !product.categoryName : product.categoryName === categoryFilter);
      const matchesBrand = brandFilter === 'all' || product.brandLabel === brandFilter;
      const matchesFamily = familyFilter === 'all' || product.familyName === familyFilter;

      const hasFiles = product.assets.some((asset) => Boolean(asset.downloadUrl));
      const matchesFileAvailability =
        fileFilter === 'all'
        || (fileFilter === 'with_files' && hasFiles)
        || (fileFilter === 'without_files' && !hasFiles);
      const matchesFileType = fileTypeFilter === 'all' || product.assets.some((asset) => asset.downloadUrl && asset.kind === fileTypeFilter);
      return matchesSearch && matchesCategory && matchesBrand && matchesFamily && matchesFileAvailability && matchesFileType;
    });
  }, [brandFilter, catalogWithFavorites.products, categoryFilter, familyFilter, fileFilter, fileTypeFilter, searchQuery]);

  const hasActiveFilters = searchQuery.trim() !== '' || categoryFilter !== 'all' || brandFilter !== 'all' || familyFilter !== 'all' || fileFilter !== 'all' || fileTypeFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setBrandFilter('all');
    setFamilyFilter('all');
    setFileFilter('all');
    setFileTypeFilter('all');
  };

  return (
    <Stack gap="lg">
      <Card withBorder radius="xl" p="lg" className="premium-hero-panel">
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Text className="eyebrow">Your Product Catalog</Text>
            <Title order={1}>Products and Files</Title>
            <Text c="dimmed" maw={760}>
              Browse the products and files in your company catalog. Account Health covers account status.
            </Text>
            {catalog.catalogView ? (
              <Group gap="xs">
                <Badge size="lg" color="blue" variant="light">
                  Your product catalog
                </Badge>
                {catalog.catalogView.brandLabel ? (
                  <Badge size="lg" color="gray" variant="light">
                    {catalog.catalogView.brandLabel}
                  </Badge>
                ) : null}
              </Group>
            ) : null}
          </Stack>
          <Badge size="xl" color="green" variant="light">
            {catalog.products.length} available
          </Badge>
        </Group>
      </Card>

      {catalogWithFavorites.products.length === 0 ? (
        <Card withBorder radius="xl" p="xl" className="premium-detail-card">
          <Stack gap="xs" align="center">
            <IconPackage size={36} />
            <Title order={3}>No products are available yet</Title>
            <Text c="dimmed" ta="center" maw={620}>
              No products are available in your catalog right now. Contact Dynamic AQS support if you need a specific product or file.
            </Text>
          </Stack>
        </Card>
      ) : (
        <>
          <Card withBorder radius="xl" p="lg" className="premium-detail-card">
            <Stack gap="md">
              <Group align="end" grow>
                <TextInput
                  label="Search catalog"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.currentTarget.value)}
                  placeholder="Search SKU, name, or description"
                  leftSection={<IconSearch size={16} />}
                />
                <Select
                  label="Category"
                  value={categoryFilter}
                  onChange={(value) => setCategoryFilter(value ?? 'all')}
                  data={categoryOptions}
                  allowDeselect={false}
                />
              </Group>
              <Group justify="space-between" align="center">
                <Button
                  variant={filtersOpen ? 'light' : 'default'}
                  leftSection={<IconFilter size={16} />}
                  onClick={() => setFiltersOpen((opened) => !opened)}
                >
                  {filtersOpen ? 'Hide filters' : 'More filters'}
                </Button>
              </Group>
              <Collapse in={filtersOpen}>
                <Stack gap="md" pt="xs">
                  <Group align="end" grow>
                    <Select
                      label="Brand"
                      value={brandFilter}
                      onChange={(value) => setBrandFilter(value ?? 'all')}
                      data={brandOptions}
                      allowDeselect={false}
                    />
                    <Select
                      label="Family"
                      value={familyFilter}
                      onChange={(value) => setFamilyFilter(value ?? 'all')}
                      data={familyOptions}
                      allowDeselect={false}
                    />
                    <Select
                      label="File type"
                      value={fileTypeFilter}
                      onChange={(value) => setFileTypeFilter(value ?? 'all')}
                      data={fileTypeOptions}
                      allowDeselect={false}
                    />
                  </Group>
                  <Group gap="sm">
                    <SegmentedControl
                      value={fileFilter}
                      onChange={(value) => setFileFilter(value as FileAvailabilityFilter)}
                      data={[
                        { value: 'all', label: 'All products' },
                        { value: 'with_files', label: 'Files available' },
                      ]}
                    />
                  </Group>
                  <Group justify="flex-end">
                    <Button
                      variant="subtle"
                      color="gray"
                      onClick={clearFilters}
                      disabled={!hasActiveFilters}
                    >
                      Clear filters
                    </Button>
                  </Group>
                </Stack>
              </Collapse>
              <Text size="sm" c="dimmed">
                Showing {filteredProducts.length} of {catalogWithFavorites.products.length} available products.
              </Text>
            </Stack>
          </Card>

          {filteredProducts.length === 0 ? (
            <Card withBorder radius="xl" p="xl" className="premium-detail-card">
              <Stack gap="xs" align="center">
                <IconFile size={36} />
                <Title order={3}>No catalog products match these filters</Title>
                <Text c="dimmed" ta="center" maw={620}>
                  Try a different SKU, product name, category, or file availability filter.
                </Text>
                <Button variant="light" color="blue" onClick={clearFilters} disabled={!hasActiveFilters}>
                  Clear filters
                </Button>
              </Stack>
            </Card>
          ) : (
            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.presentationId}
                  assetActions={assetActions}
                  favoriteActions={favoriteActions}
                  product={product}
                />
              ))}
            </SimpleGrid>
          )}
        </>
      )}
    </Stack>
  );
}

function buildProductOptionList(
  products: DealerCatalogProductWithFavorites[],
  readValue: (product: DealerCatalogProductWithFavorites) => string | undefined,
  allLabel: string,
) {
  const values = new Set(products.map(readValue).filter((value): value is string => Boolean(value)));
  return [
    { value: 'all', label: allLabel },
    ...Array.from(values)
      .sort((first, second) => first.localeCompare(second))
      .map((value) => ({ value, label: value })),
  ];
}

function ProductCard({
  assetActions,
  favoriteActions,
  product,
}: {
  assetActions?: DealerCatalogAssetActions | undefined;
  favoriteActions?: DealerCatalogFavoriteActions | undefined;
  product: DealerCatalogProductWithFavorites;
}) {
  const availableFiles = product.assets.filter((asset) => Boolean(asset.downloadUrl));
  const primaryFiles = availableFiles.slice(0, 2);
  const isFavorite = Boolean(product.isFavorite);
  const canToggleFavorite = Boolean(favoriteActions?.isAvailable && favoriteActions.toggleFavorite);
  const supportingDetails = [product.familyName, product.brandLabel].filter(Boolean).join(' / ');

  return (
    <Card withBorder radius="xl" p="lg" className="premium-detail-card">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap="xs">
              <Badge color="gray" variant="light">
                {product.sku}
              </Badge>
              {product.categoryName ? (
                <Badge color="blue" variant="light">
                  {product.categoryName}
                </Badge>
              ) : null}
            </Group>
            <Title order={3}>{product.displayName}</Title>
            {supportingDetails ? (
              <Text size="sm" c="dimmed">
                {supportingDetails}
              </Text>
            ) : null}
            {product.shortDescription ? (
              <Text c="dimmed">{product.shortDescription}</Text>
            ) : null}
          </Stack>
          <Group gap="xs">
            {isFavorite || product.favoriteCount > 0 ? (
              <Badge color="yellow" variant="light">
                {isFavorite ? 'Saved' : `${product.favoriteCount} saved`}
              </Badge>
            ) : null}
            <Button
              size="compact-xs"
              variant={isFavorite ? 'light' : 'default'}
              color={isFavorite ? 'yellow' : 'blue'}
              leftSection={isFavorite ? <IconStarFilled size={13} /> : <IconStar size={13} />}
              disabled={!canToggleFavorite || favoriteActions?.updatingPresentationId === product.presentationId}
              onClick={() => {
                if (favoriteActions?.toggleFavorite) {
                  void favoriteActions.toggleFavorite(product);
                }
              }}
            >
              {isFavorite ? 'Saved' : 'Save'}
            </Button>
          </Group>
        </Group>

        {product.specSummary ? (
          <Text size="sm">{product.specSummary}</Text>
        ) : null}

        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            {availableFiles.length} file{availableFiles.length === 1 ? '' : 's'} available
          </Text>
          <Anchor
            component={Link}
            href={`/dealer/catalog/${encodeURIComponent(product.presentationId)}`}
            size="sm"
            fw={700}
          >
            View all files <IconArrowRight size={14} style={{ verticalAlign: 'text-bottom' }} />
          </Anchor>
        </Group>

        <Stack gap="xs">
          <Text size="sm" fw={700}>
            Top files
          </Text>
          {primaryFiles.length === 0 ? (
            <Text size="sm" c="dimmed">
              No files are available for this product right now. Contact Dynamic AQS support if you need a specific file.
            </Text>
          ) : (
            primaryFiles.map((asset) => (
              <Group key={`${asset.id}-${asset.role}`} justify="space-between" gap="sm" wrap="nowrap">
                <Stack gap={0}>
                  <Text size="sm" fw={500}>
                    {asset.title}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {asset.role.replace(/_/g, ' ')}
                  </Text>
                </Stack>
                <Button
                  size="compact-xs"
                  variant="light"
                  leftSection={<IconDownload size={13} />}
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
                  Open file
                </Button>
              </Group>
            ))
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
