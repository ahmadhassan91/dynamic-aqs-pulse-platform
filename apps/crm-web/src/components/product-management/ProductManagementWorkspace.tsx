'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Group, Loader, NumberInput, Paper, Select, SimpleGrid, Stack, Switch, Table, Tabs, Text, Textarea, TextInput, Title } from '@mantine/core';
import type { ProductReferenceImportPreviewResponse } from '@pulse/contracts/product-management';
import { IconAlertTriangle, IconPackage, IconSearch, IconShieldCheck } from '@tabler/icons-react';
import {
  createProductManagementCategory,
  fetchProductManagementCategories,
  fetchProductManagementProducts,
  previewProductReferenceImport,
  updateProductManagementCategory,
  type ListProductsResponse,
  type ProductCategorySummary,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

type ProductTab = 'categories' | 'products' | 'readiness' | 'publish';
type CategoryFormState = {
  code: string;
  name: string;
  parentId: string | null;
  description: string;
  categoryType: string;
  regionScope: string;
  isActive: boolean;
  sortOrder: number;
};

const emptyCategoryForm: CategoryFormState = {
  code: '',
  name: '',
  parentId: null,
  description: '',
  categoryType: '',
  regionScope: '',
  isActive: true,
  sortOrder: 100,
};

export function ProductManagementWorkspace() {
  const { apiBaseUrl, auth } = usePulseSession();
  const [activeTab, setActiveTab] = useState<ProductTab>('categories');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<ListProductsResponse>({ items: [], total: 0 });
  const [categories, setCategories] = useState<ProductCategorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ProductReferenceImportPreviewResponse | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'groups') {
      setActiveTab('categories');
    } else if (tab && ['categories', 'products', 'readiness', 'publish'].includes(tab)) {
      setActiveTab(tab as ProductTab);
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

  const categoryParentOptions = useMemo(() => categories
    .filter((category) => category.id !== editingCategoryId)
    .map((category) => ({ value: category.id, label: `${category.name} (${category.code})` })), [categories, editingCategoryId]);

  const reloadCatalog = async () => {
    if (!auth) return;
    const [productResponse, categoryResponse] = await Promise.all([
      fetchProductManagementProducts(apiBaseUrl, auth.tokens.accessToken, { search, limit: 100 }),
      fetchProductManagementCategories(apiBaseUrl, auth.tokens.accessToken),
    ]);
    setProducts(productResponse);
    setCategories(categoryResponse.items);
  };

  const handleEditCategory = (category: ProductCategorySummary) => {
    setEditingCategoryId(category.id);
    setCategoryForm({
      code: category.code,
      name: category.name,
      parentId: category.parentId ?? null,
      description: category.description ?? '',
      categoryType: category.categoryType ?? '',
      regionScope: category.regionScope ?? '',
      isActive: category.isActive,
      sortOrder: category.sortOrder,
    });
    setActiveTab('categories');
  };

  const handleResetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryForm(emptyCategoryForm);
  };

  const handleSaveCategory = async () => {
    if (!auth) return;
    setIsSavingCategory(true);
    setError(null);
    const payload = {
      code: categoryForm.code,
      name: categoryForm.name,
      parentId: categoryForm.parentId,
      description: categoryForm.description || null,
      categoryType: categoryForm.categoryType || null,
      regionScope: categoryForm.regionScope || null,
      isActive: categoryForm.isActive,
      sortOrder: categoryForm.sortOrder,
    };
    try {
      if (editingCategoryId) {
        await updateProductManagementCategory(apiBaseUrl, auth.tokens.accessToken, editingCategoryId, payload);
      } else {
        await createProductManagementCategory(apiBaseUrl, auth.tokens.accessToken, payload);
      }
      handleResetCategoryForm();
      await reloadCatalog();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSavingCategory(false);
    }
  };

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

      <Tabs value={activeTab} onChange={(value) => setActiveTab((value as ProductTab) ?? 'categories')}>
        <Tabs.List>
          <Tabs.Tab value="categories" leftSection={<IconShieldCheck size={16} />}>Categories</Tabs.Tab>
          <Tabs.Tab value="products" leftSection={<IconPackage size={16} />}>Products</Tabs.Tab>
          <Tabs.Tab value="readiness">Readiness</Tabs.Tab>
          <Tabs.Tab value="publish">Publish Control</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="categories" pt="md">
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <Paper withBorder p="md">
              <Stack gap="sm">
                <Title order={4}>{editingCategoryId ? 'Edit Category' : 'Create Category'}</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label="Code"
                    value={categoryForm.code}
                    onChange={(event) => setCategoryForm((current) => ({ ...current, code: event.currentTarget.value }))}
                    required
                  />
                  <TextInput
                    label="Name"
                    value={categoryForm.name}
                    onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.currentTarget.value }))}
                    required
                  />
                </SimpleGrid>
                <Select
                  label="Parent category"
                  clearable
                  data={categoryParentOptions}
                  value={categoryForm.parentId}
                  onChange={(value) => setCategoryForm((current) => ({ ...current, parentId: value }))}
                />
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label="Type"
                    value={categoryForm.categoryType}
                    onChange={(event) => setCategoryForm((current) => ({ ...current, categoryType: event.currentTarget.value }))}
                  />
                  <TextInput
                    label="Region scope"
                    value={categoryForm.regionScope}
                    onChange={(event) => setCategoryForm((current) => ({ ...current, regionScope: event.currentTarget.value }))}
                  />
                </SimpleGrid>
                <Textarea
                  label="Description"
                  minRows={3}
                  value={categoryForm.description}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.currentTarget.value }))}
                />
                <Group align="flex-end">
                  <NumberInput
                    label="Sort order"
                    min={0}
                    value={categoryForm.sortOrder}
                    onChange={(value) => setCategoryForm((current) => ({ ...current, sortOrder: typeof value === 'number' ? value : 100 }))}
                  />
                  <Switch
                    label="Active"
                    checked={categoryForm.isActive}
                    onChange={(event) => setCategoryForm((current) => ({ ...current, isActive: event.currentTarget.checked }))}
                  />
                </Group>
                <Group justify="flex-end">
                  <Button variant="subtle" onClick={handleResetCategoryForm}>Reset</Button>
                  <Button onClick={handleSaveCategory} loading={isSavingCategory}>
                    {editingCategoryId ? 'Save Category' : 'Create Category'}
                  </Button>
                </Group>
              </Stack>
            </Paper>

            <Paper withBorder>
              {isLoading ? (
                <Group justify="center" p="xl"><Loader /></Group>
              ) : (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Scope</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {categories.map((category) => (
                      <Table.Tr key={category.id}>
                        <Table.Td>
                          <Text fw={600}>{category.name}</Text>
                          <Text size="xs" c="dimmed">{category.code}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text size="sm">{category.categoryType ?? 'General'}</Text>
                            <Text size="xs" c="dimmed">{category.regionScope ?? 'All regions'}</Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td><Badge color={category.isActive ? 'green' : 'gray'} variant="light">{category.isActive ? 'Active' : 'Inactive'}</Badge></Table.Td>
                        <Table.Td><Button size="xs" variant="light" onClick={() => handleEditCategory(category)}>Edit</Button></Table.Td>
                      </Table.Tr>
                    ))}
                    {!categories.length ? (
                      <Table.Tr><Table.Td colSpan={4}><Text ta="center" c="dimmed" py="lg">No categories configured yet.</Text></Table.Td></Table.Tr>
                    ) : null}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>
          </SimpleGrid>
          <Paper withBorder p="md" mt="md">
            <Stack gap="xs">
              <Title order={4}>Visibility Governance</Title>
              <Text c="dimmed">Dealer portal visibility is still resolved from catalog inclusions, region, brand/private label, ownership group, and portal eligibility before publish.</Text>
              <Badge variant="light">Pricing remains separate from product visibility</Badge>
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
