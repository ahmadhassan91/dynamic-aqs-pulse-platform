'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Group, Loader, Paper, SimpleGrid, Stack, Table, Tabs, Text, TextInput, Title } from '@mantine/core';
import type { ProductReferenceImportPreviewResponse } from '@pulse/contracts/product-management';
import { IconAlertTriangle, IconPackage, IconSearch, IconShieldCheck } from '@tabler/icons-react';
import {
  fetchProductManagementCategories,
  fetchProductManagementProducts,
  previewProductReferenceImport,
  type ListProductsResponse,
  type ProductCategorySummary,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

type ProductTab = 'groups' | 'products' | 'readiness' | 'publish';

export function ProductManagementWorkspace() {
  const { apiBaseUrl, auth } = usePulseSession();
  const [activeTab, setActiveTab] = useState<ProductTab>('groups');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<ListProductsResponse>({ items: [], total: 0 });
  const [categories, setCategories] = useState<ProductCategorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ProductReferenceImportPreviewResponse | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as ProductTab | null;
    if (tab && ['groups', 'products', 'readiness', 'publish'].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [productResponse, categoryResponse] = await Promise.all([
          fetchProductManagementProducts(apiBaseUrl, auth.tokens.accessToken, { search, limit: 100 }),
          fetchProductManagementCategories(apiBaseUrl, auth.tokens.accessToken),
        ]);
        if (!cancelled) {
          setProducts(productResponse);
          setCategories(categoryResponse.items);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, search]);

  const metrics = useMemo(() => ({
    totalProducts: products.total,
    categories: categories.length,
    dealerVisible: products.items.filter((product) => product.isDealerVisible).length,
    acumaticaLinked: products.items.filter((product) => product.acumaticaInventoryId).length,
  }), [categories.length, products]);

  const handlePreviewImport = async () => {
    if (!auth) return;
    setIsPreviewingImport(true);
    setError(null);
    try {
      const response = await previewProductReferenceImport(apiBaseUrl, auth.tokens.accessToken, { limit: 750 });
      setImportPreview(response);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : String(previewError));
    } finally {
      setIsPreviewingImport(false);
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={2}>Product Management</Title>
          <Text c="dimmed">Govern categories, product presentations, dealer visibility, asset readiness, and approved catalog publish.</Text>
        </Stack>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <Metric label="Products" value={metrics.totalProducts} />
        <Metric label="Categories" value={metrics.categories} />
        <Metric label="Dealer Visible" value={metrics.dealerVisible} />
        <Metric label="Acumatica Linked" value={metrics.acumaticaLinked} />
      </SimpleGrid>

      {error ? (
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Product API not ready">
          {error}
        </Alert>
      ) : null}

      <Tabs value={activeTab} onChange={(value) => setActiveTab((value as ProductTab) ?? 'groups')}>
        <Tabs.List>
          <Tabs.Tab value="groups" leftSection={<IconShieldCheck size={16} />}>Dealer Groups</Tabs.Tab>
          <Tabs.Tab value="products" leftSection={<IconPackage size={16} />}>Products</Tabs.Tab>
          <Tabs.Tab value="readiness">Readiness</Tabs.Tab>
          <Tabs.Tab value="publish">Publish Control</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="groups" pt="md">
          <Paper withBorder p="md">
            <Stack gap="xs">
              <Title order={4}>Group-first catalog governance</Title>
              <Text c="dimmed">Product visibility will be resolved by region, brand/private label, affinity group, ownership group, and portal eligibility before dealer portal publish.</Text>
              <Badge variant="light">Pricing stays separate from product visibility</Badge>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="products" pt="md">
          <Stack gap="md">
            <Group align="flex-end">
              <TextInput
                style={{ flex: 1 }}
                leftSection={<IconSearch size={16} />}
                placeholder="Search SKU, product name, or Acumatica inventory ID"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
              <Button variant="light" onClick={handlePreviewImport} loading={isPreviewingImport}>
                Preview CSV Import
              </Button>
            </Group>
            {importPreview ? (
              <Alert color="blue" title="Curated reference import preview">
                <Text size="sm">
                  {importPreview.uniqueSkus} unique SKUs from {importPreview.acumaticaRows} Acumatica rows and {importPreview.shopifyRows} Shopify rows.
                  {' '}Detected {importPreview.candidateCategories} categories and {importPreview.imageAssets} image assets. Shopify remains legacy reference data.
                </Text>
              </Alert>
            ) : null}
            <Paper withBorder>
              {isLoading ? (
                <Group justify="center" p="xl"><Loader /></Group>
              ) : (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>SKU</Table.Th>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Source</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {products.items.map((product) => (
                      <Table.Tr key={product.id}>
                        <Table.Td>{product.sku}</Table.Td>
                        <Table.Td>
                          <Text component={Link} href={`/product-management/products/${product.id}`} fw={600}>
                            {product.productName}
                          </Text>
                        </Table.Td>
                        <Table.Td>{product.category?.name ?? 'Unassigned'}</Table.Td>
                        <Table.Td><Badge variant="light">{product.sourceSystem}</Badge></Table.Td>
                        <Table.Td>{product.lifecycleStatus}</Table.Td>
                      </Table.Tr>
                    ))}
                    {!products.items.length ? (
                      <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="lg">No products loaded yet.</Text></Table.Td></Table.Tr>
                    ) : null}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="readiness" pt="md">
          <Paper withBorder p="md">
            <Title order={4}>Go-live checklist</Title>
            <Text c="dimmed">Publish validation will block missing category, content, primary image, required documents, visibility rules, and unresolved wrong-brand warnings.</Text>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="publish" pt="md">
          <Paper withBorder p="md">
            <Title order={4}>Dealer catalog publish feed</Title>
            <Text c="dimmed">Dealer Portal will consume approved Pulse catalog views, not raw ERP rows, Shopify seed data, or unrestricted asset library records.</Text>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Paper withBorder p="md">
      <Text size="xs" tt="uppercase" fw={700} c="dimmed">{label}</Text>
      <Text size="xl" fw={700}>{value}</Text>
    </Paper>
  );
}
