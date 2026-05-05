'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Alert, Badge, Button, Group, Loader, NumberInput, Paper, Select, SimpleGrid, Stack, Switch, Table, Tabs, Text, Textarea, TextInput, Title } from '@mantine/core';
import {
  type ProductDetail,
  type DealerCatalogViewSummary,
  type ProductPublishStatusKey,
  type ProductReferenceImportPreviewResponse,
} from '@pulse/contracts/product-management';
import { IconAlertTriangle, IconPackage, IconSearch, IconShieldCheck } from '@tabler/icons-react';
import {
  createDealerCatalogView,
  createProductManagementCategory,
  createProductManagementFamily,
  fetchProductManagementCategories,
  fetchDealerCatalogViews,
  fetchProductManagementFamilies,
  fetchProductManagementProductDetail,
  fetchProductManagementProducts,
  previewProductReferenceImport,
  updateDealerCatalogView,
  updateProductManagementCategory,
  updateProductManagementFamily,
  type ListProductsResponse,
  type ProductCategorySummary,
  type ProductFamilySummary,
} from '@/lib/pulse-api';
import { APP_LEAD_REGION_OPTIONS } from '@/lib/lead-form-options';
import { usePulseSession } from '@/lib/pulse-session';

type ProductTab = 'categories' | 'families' | 'products' | 'visibility' | 'readiness' | 'publish';
type CatalogViewRow = {
  key: string;
  catalogViewId?: string | undefined;
  catalogView: string;
  resolverInput: string;
  region: string;
  brand: string;
  productCount: number;
  publishedCount: number;
  blockedCount: number;
  isConfigured: boolean;
};
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
type CatalogViewFormState = {
  name: string;
  kind: DealerCatalogViewSummary['kind'];
  resolverKey: string;
  resolverLabel: string;
  regionScope: string;
  brandLabel: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
  precedence: number;
};
type FamilyFormState = {
  code: string;
  name: string;
  description: string;
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
const emptyCatalogViewForm: CatalogViewFormState = {
  name: '',
  kind: 'standard',
  resolverKey: '',
  resolverLabel: '',
  regionScope: '',
  brandLabel: '',
  description: '',
  isDefault: false,
  isActive: true,
  precedence: 100,
};
const emptyFamilyForm: FamilyFormState = {
  code: '',
  name: '',
  description: '',
  isActive: true,
  sortOrder: 100,
};

const PRODUCT_PUBLISH_STATUS_OPTIONS: ProductPublishStatusKey[] = ['draft', 'ready_for_review', 'approved', 'published', 'blocked', 'archived'];
const PRODUCT_TABS: ProductTab[] = ['categories', 'families', 'products', 'visibility', 'readiness', 'publish'];
const CATALOG_VIEW_KIND_OPTIONS: Array<{ value: DealerCatalogViewSummary['kind']; label: string; helper: string; precedence: number }> = [
  { value: 'standard', label: 'Standard dealers', helper: 'Default eligible dealer catalog', precedence: 100 },
  { value: 'affinity', label: 'Affinity catalog', helper: 'Nexstar, EGIA, CertainPath, and similar networks', precedence: 50 },
  { value: 'ownership', label: 'Ownership / PE catalog', helper: 'Common-owner or private-equity overlay', precedence: 40 },
  { value: 'independent', label: 'Independent catalog', helper: 'Dealers without affinity/franchise or ownership overlay', precedence: 80 },
  { value: 'region', label: 'Regional catalog', helper: 'US, Canada, province/state, or region-specific view', precedence: 70 },
  { value: 'brand', label: 'Brand catalog', helper: 'Brand-specific presentation and files', precedence: 30 },
  { value: 'private_label', label: 'Private-label catalog', helper: 'Dealer/private-label presentation layer', precedence: 20 },
  { value: 'account_override', label: 'Account override', helper: 'Specific dealer/account exception', precedence: 10 },
];
const CATEGORY_TYPE_OPTIONS = [
  { value: 'portal_section', label: 'Dealer portal section' },
  { value: 'product_line', label: 'Product line' },
  { value: 'application', label: 'Application / use case' },
  { value: 'brand', label: 'Brand / private label' },
  { value: 'legacy_shopify_collection', label: 'Legacy Shopify collection' },
  { value: 'internal_reference', label: 'Internal reference' },
];
const CATEGORY_REGION_OPTIONS = [
  { value: 'ALL_REGIONS', label: 'All regions' },
  { value: 'COUNTRY_US', label: 'Country: United States' },
  { value: 'COUNTRY_CA', label: 'Country: Canada' },
  ...APP_LEAD_REGION_OPTIONS.map((option) => ({
    value: option.value,
    label: `${option.group}: ${option.label} (${option.value})`,
  })),
];

export function ProductManagementWorkspace() {
  const { apiBaseUrl, auth } = usePulseSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ProductTab>('visibility');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [familyFilter, setFamilyFilter] = useState<string | null>(null);
  const [publishStatusFilter, setPublishStatusFilter] = useState<ProductPublishStatusKey | null>(null);
  const [products, setProducts] = useState<ListProductsResponse>({ items: [], total: 0 });
  const [productDetails, setProductDetails] = useState<ProductDetail[]>([]);
  const [categories, setCategories] = useState<ProductCategorySummary[]>([]);
  const [families, setFamilies] = useState<ProductFamilySummary[]>([]);
  const [catalogViews, setCatalogViews] = useState<DealerCatalogViewSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isSavingCatalogView, setIsSavingCatalogView] = useState(false);
  const [isSavingFamily, setIsSavingFamily] = useState(false);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ProductReferenceImportPreviewResponse | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCatalogViewId, setEditingCatalogViewId] = useState<string | null>(null);
  const [editingFamilyId, setEditingFamilyId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [catalogViewForm, setCatalogViewForm] = useState<CatalogViewFormState>(emptyCatalogViewForm);
  const [familyForm, setFamilyForm] = useState<FamilyFormState>(emptyFamilyForm);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'groups') {
      setActiveTab('visibility');
    } else if (tab && PRODUCT_TABS.includes(tab as ProductTab)) {
      setActiveTab(tab as ProductTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const productQuery = {
          search,
          limit: 100,
          ...(categoryFilter ? { categoryId: categoryFilter } : {}),
          ...(familyFilter ? { familyId: familyFilter } : {}),
          ...(publishStatusFilter ? { publishStatus: publishStatusFilter } : {}),
        };
        const [productResponse, categoryResponse, familyResponse, catalogViewResponse] = await Promise.all([
          fetchProductManagementProducts(apiBaseUrl, auth.tokens.accessToken, productQuery),
          fetchProductManagementCategories(apiBaseUrl, auth.tokens.accessToken),
          fetchProductManagementFamilies(apiBaseUrl, auth.tokens.accessToken),
          fetchDealerCatalogViews(apiBaseUrl, auth.tokens.accessToken, { isActive: true }),
        ]);
        const detailResponse = await Promise.all(
          productResponse.items.map((product) => fetchProductManagementProductDetail(apiBaseUrl, auth.tokens.accessToken, product.id)),
        );
        if (!cancelled) {
          setProducts(productResponse);
          setProductDetails(detailResponse.filter(Boolean) as ProductDetail[]);
          setCategories(categoryResponse.items);
          setFamilies(familyResponse.items);
          setCatalogViews(catalogViewResponse.items);
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
  }, [apiBaseUrl, auth, categoryFilter, familyFilter, publishStatusFilter, search]);

  const metrics = useMemo(() => ({
    totalProducts: products.total,
    categories: categories.length,
    families: families.length,
    dealerVisible: catalogViews.length,
    acumaticaLinked: products.items.filter((product) => product.acumaticaInventoryId).length,
  }), [catalogViews.length, categories.length, families.length, products]);

  const categoryParentOptions = useMemo(() => categories
    .filter((category) => category.id !== editingCategoryId)
    .map((category) => ({ value: category.id, label: `${category.name} (${category.code})` })), [categories, editingCategoryId]);
  const categoryFilterOptions = useMemo(() => categories.map((category) => ({
    value: category.id,
    label: `${category.name} (${category.code})`,
  })), [categories]);
  const familyFilterOptions = useMemo(() => families.map((family) => ({
    value: family.id,
    label: `${family.name} (${family.code})`,
  })), [families]);
  const publishStatusOptions = useMemo(() => PRODUCT_PUBLISH_STATUS_OPTIONS.map((status) => ({
    value: status,
    label: formatLabel(status),
  })), []);
  const readinessRows = useMemo(() => productDetails.map((product) => {
    const presentation = product.presentations[0];
    const hasContent = Boolean(presentation?.displayName?.trim() && presentation.shortDescription?.trim());
    const hasPrimaryImage = product.assetAssignments.some((assignment) => assignment.role === 'primary_image' && assignment.status === 'active' && assignment.reviewStatus === 'approved');
    const hasDealerVisibility = product.inclusions.some((inclusion) => inclusion.isVisible);
    const blockers = [
      product.category ? null : 'Missing category',
      hasContent ? null : 'Missing dealer-facing content',
      hasPrimaryImage ? null : 'Missing approved primary image',
      hasDealerVisibility ? null : 'Missing dealer catalog view rule',
    ].filter(Boolean) as string[];
    const warnings = [
      product.family ? null : 'No family assigned',
      product.assetAssignments.some((assignment) => assignment.role === 'spec_sheet') ? null : 'No spec sheet attached',
      product.assetAssignments.some((assignment) => assignment.role === 'brochure') ? null : 'No brochure attached',
    ].filter(Boolean) as string[];
    return {
      product,
      presentation,
      status: blockers.length ? 'blocked' : warnings.length ? 'warning' : 'pass',
      blockers,
      warnings,
    };
  }), [productDetails]);
  const publishRows = useMemo(() => productDetails.map((product) => {
    const presentation = product.presentations[0];
    const readiness = readinessRows.find((row) => row.product.id === product.id);
    return {
      product,
      presentation,
      readinessStatus: readiness?.status ?? 'blocked',
      visibilityCount: product.inclusions.filter((inclusion) => inclusion.isVisible).length,
      assetCount: product.assetAssignments.length,
    };
  }), [productDetails, readinessRows]);
  const visibilityRows = useMemo(() => productDetails.flatMap((product) => {
    const presentation = product.presentations[0];
    if (!product.inclusions.length) {
      return [{
        id: `${product.id}-missing`,
        product,
        presentation,
        catalogViewId: undefined,
        audience: 'No visibility rule',
        region: presentation?.regionScope ?? 'All regions',
        brand: presentation?.brandLabel ?? 'Default brand',
        isVisible: false,
        publishStatus: presentation?.publishStatus ?? 'draft',
      }];
    }
    return product.inclusions.map((inclusion) => ({
      id: inclusion.id,
      product,
      presentation,
      catalogViewId: inclusion.dealerCatalogViewId,
      audience: inclusion.dealerCatalogView?.name ?? formatCatalogAudience(inclusion.dealerGroupType, inclusion.dealerGroupId),
      region: inclusion.regionScope ?? presentation?.regionScope ?? 'All regions',
      brand: inclusion.brandLabel ?? presentation?.brandLabel ?? 'Default brand',
      isVisible: inclusion.isVisible,
      publishStatus: inclusion.publishStatus,
    }));
  }), [productDetails]);
  const catalogViewRows = useMemo(() => {
    const grouped = new Map<string, CatalogViewRow>();
    for (const catalogView of catalogViews) {
      const key = catalogView.id;
      grouped.set(key, {
        key,
        catalogViewId: catalogView.id,
        catalogView: catalogView.name,
        resolverInput: buildCatalogViewResolverLabel(catalogView),
        region: catalogView.regionScope ?? 'All regions',
        brand: catalogView.brandLabel ?? 'Default brand',
        productCount: 0,
        publishedCount: 0,
        blockedCount: 0,
        isConfigured: true,
      });
    }
    for (const row of visibilityRows) {
      const key = row.catalogViewId ?? `${row.audience}|${row.region}|${row.brand}`;
      const existing = grouped.get(key) ?? {
        key,
        catalogViewId: row.catalogViewId,
        catalogView: row.audience,
        resolverInput: buildResolverInputLabel(row.audience),
        region: row.region,
        brand: row.brand,
        productCount: 0,
        publishedCount: 0,
        blockedCount: 0,
        isConfigured: false,
      };
      existing.productCount += row.isVisible ? 1 : 0;
      existing.publishedCount += row.isVisible && row.publishStatus === 'published' ? 1 : 0;
      existing.blockedCount += row.isVisible ? 0 : 1;
      grouped.set(key, existing);
    }
    return Array.from(grouped.values()).sort((left, right) => left.catalogView.localeCompare(right.catalogView));
  }, [catalogViews, visibilityRows]);

  const reloadCatalog = async () => {
    if (!auth) return;
    const productQuery = {
      search,
      limit: 100,
      ...(categoryFilter ? { categoryId: categoryFilter } : {}),
      ...(familyFilter ? { familyId: familyFilter } : {}),
      ...(publishStatusFilter ? { publishStatus: publishStatusFilter } : {}),
    };
    const [productResponse, categoryResponse, familyResponse, catalogViewResponse] = await Promise.all([
      fetchProductManagementProducts(apiBaseUrl, auth.tokens.accessToken, productQuery),
      fetchProductManagementCategories(apiBaseUrl, auth.tokens.accessToken),
      fetchProductManagementFamilies(apiBaseUrl, auth.tokens.accessToken),
      fetchDealerCatalogViews(apiBaseUrl, auth.tokens.accessToken, { isActive: true }),
    ]);
    const detailResponse = await Promise.all(
      productResponse.items.map((product) => fetchProductManagementProductDetail(apiBaseUrl, auth.tokens.accessToken, product.id)),
    );
    setProducts(productResponse);
    setProductDetails(detailResponse.filter(Boolean) as ProductDetail[]);
    setCategories(categoryResponse.items);
    setFamilies(familyResponse.items);
    setCatalogViews(catalogViewResponse.items);
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

  const handleEditFamily = (family: ProductFamilySummary) => {
    setEditingFamilyId(family.id);
    setFamilyForm({
      code: family.code,
      name: family.name,
      description: family.description ?? '',
      isActive: family.isActive,
      sortOrder: family.sortOrder,
    });
    setActiveTab('families');
  };

  const handleEditCatalogView = (catalogView: DealerCatalogViewSummary) => {
    setEditingCatalogViewId(catalogView.id);
    setCatalogViewForm({
      name: catalogView.name,
      kind: catalogView.kind,
      resolverKey: catalogView.resolverKey ?? '',
      resolverLabel: catalogView.resolverLabel ?? '',
      regionScope: catalogView.regionScope ?? '',
      brandLabel: catalogView.brandLabel ?? '',
      description: catalogView.description ?? '',
      isDefault: catalogView.isDefault,
      isActive: catalogView.isActive,
      precedence: catalogView.precedence,
    });
    setActiveTab('visibility');
  };

  const resetCatalogViewForm = () => {
    setEditingCatalogViewId(null);
    setCatalogViewForm(emptyCatalogViewForm);
  };

  const handleSaveCatalogView = async () => {
    if (!auth || !catalogViewForm.name.trim()) return;
    setIsSavingCatalogView(true);
    setError(null);
    const payload = {
      name: catalogViewForm.name.trim(),
      kind: catalogViewForm.kind,
      resolverKey: emptyToNull(catalogViewForm.resolverKey),
      resolverLabel: emptyToNull(catalogViewForm.resolverLabel),
      regionScope: emptyToNull(catalogViewForm.regionScope),
      brandLabel: emptyToNull(catalogViewForm.brandLabel),
      description: emptyToNull(catalogViewForm.description),
      isDefault: catalogViewForm.isDefault,
      isActive: catalogViewForm.isActive,
      precedence: catalogViewForm.precedence,
    };
    try {
      if (editingCatalogViewId) {
        await updateDealerCatalogView(apiBaseUrl, auth.tokens.accessToken, editingCatalogViewId, payload);
      } else {
        await createDealerCatalogView(apiBaseUrl, auth.tokens.accessToken, payload);
      }
      resetCatalogViewForm();
      await reloadCatalog();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSavingCatalogView(false);
    }
  };

  const handleResetFamilyForm = () => {
    setEditingFamilyId(null);
    setFamilyForm(emptyFamilyForm);
  };

  const handleSaveFamily = async () => {
    if (!auth) return;
    setIsSavingFamily(true);
    setError(null);
    const payload = {
      code: familyForm.code,
      name: familyForm.name,
      description: familyForm.description || null,
      isActive: familyForm.isActive,
      sortOrder: familyForm.sortOrder,
    };
    try {
      if (editingFamilyId) {
        await updateProductManagementFamily(apiBaseUrl, auth.tokens.accessToken, editingFamilyId, payload);
      } else {
        await createProductManagementFamily(apiBaseUrl, auth.tokens.accessToken, payload);
      }
      handleResetFamilyForm();
      await reloadCatalog();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSavingFamily(false);
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
          <Text c="dimmed">Prepare dealer catalog views: organize products, attach approved files, resolve dealer context, and publish only when each catalog view is ready.</Text>
        </Stack>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <Metric label="Dealer Catalog Views" value={catalogViewRows.length} />
        <Metric label="Products With View Rules" value={visibilityRows.filter((row) => row.isVisible).length} />
        <Metric label="Products Missing View" value={visibilityRows.filter((row) => !row.isVisible).length} />
        <Metric label="Ready To Publish" value={readinessRows.filter((row) => row.status === 'pass').length} />
      </SimpleGrid>

      {error ? (
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Product API not ready">
          {error}
        </Alert>
      ) : null}

      <Tabs
        value={activeTab}
        onChange={(value) => {
          const nextTab = (value as ProductTab | null) ?? 'visibility';
          setActiveTab(nextTab);
          const nextParams = new URLSearchParams(searchParams.toString());
          nextParams.set('tab', nextTab);
          router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="visibility">Catalog Views</Tabs.Tab>
          <Tabs.Tab value="products" leftSection={<IconPackage size={16} />}>Products</Tabs.Tab>
          <Tabs.Tab value="readiness">Files & Readiness</Tabs.Tab>
          <Tabs.Tab value="publish">Ready To Publish</Tabs.Tab>
          <Tabs.Tab value="categories" leftSection={<IconShieldCheck size={16} />}>Catalog Setup</Tabs.Tab>
          <Tabs.Tab value="families">Families Setup</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="categories" pt="md">
          <Alert color="blue" mb="md" title="Catalog setup, not dealer groups">
            Categories organize navigation and reporting. Families group related SKUs. Dealer-specific visibility belongs in Dealer Catalog Views.
          </Alert>
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
                  <Select
                    label="Type"
                    placeholder="Choose category purpose"
                    clearable
                    searchable
                    data={CATEGORY_TYPE_OPTIONS}
                    value={categoryForm.categoryType || null}
                    onChange={(value) => setCategoryForm((current) => ({ ...current, categoryType: value ?? '' }))}
                  />
                  <Select
                    label="Region scope"
                    placeholder="All regions"
                    clearable
                    searchable
                    data={CATEGORY_REGION_OPTIONS}
                    value={categoryForm.regionScope || null}
                    onChange={(value) => setCategoryForm((current) => ({ ...current, regionScope: value ?? '' }))}
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
              <Title order={4}>Catalog View Governance</Title>
              <Text c="dimmed">Dealer portal visibility is resolved from catalog views using region, brand/private label, affinity, ownership/PE, independent status, and portal eligibility before publish.</Text>
              <Badge variant="light">Pricing remains separate from product visibility</Badge>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="families" pt="md">
          <Alert color="blue" mb="md" title="Product family">
            Families group sibling or variant-like SKUs. They do not decide which dealer can see a product.
          </Alert>
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <Paper withBorder p="md">
              <Stack gap="sm">
                <Title order={4}>{editingFamilyId ? 'Edit Family' : 'Create Family'}</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label="Code"
                    value={familyForm.code}
                    onChange={(event) => setFamilyForm((current) => ({ ...current, code: event.currentTarget.value }))}
                    required
                  />
                  <TextInput
                    label="Name"
                    value={familyForm.name}
                    onChange={(event) => setFamilyForm((current) => ({ ...current, name: event.currentTarget.value }))}
                    required
                  />
                </SimpleGrid>
                <Textarea
                  label="Description"
                  minRows={3}
                  value={familyForm.description}
                  onChange={(event) => setFamilyForm((current) => ({ ...current, description: event.currentTarget.value }))}
                />
                <Group align="flex-end">
                  <NumberInput
                    label="Sort order"
                    min={0}
                    value={familyForm.sortOrder}
                    onChange={(value) => setFamilyForm((current) => ({ ...current, sortOrder: typeof value === 'number' ? value : 100 }))}
                  />
                  <Switch
                    label="Active"
                    checked={familyForm.isActive}
                    onChange={(event) => setFamilyForm((current) => ({ ...current, isActive: event.currentTarget.checked }))}
                  />
                </Group>
                <Group justify="flex-end">
                  <Button variant="subtle" onClick={handleResetFamilyForm}>Reset</Button>
                  <Button onClick={handleSaveFamily} loading={isSavingFamily}>{editingFamilyId ? 'Save Family' : 'Create Family'}</Button>
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
                      <Table.Th>Family</Table.Th>
                      <Table.Th>Products</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {families.map((family) => (
                      <Table.Tr key={family.id}>
                        <Table.Td>
                          <Text fw={600}>{family.name}</Text>
                          <Text size="xs" c="dimmed">{family.code}</Text>
                        </Table.Td>
                        <Table.Td>{products.items.filter((product) => product.family?.id === family.id).length}</Table.Td>
                        <Table.Td><Badge color={family.isActive ? 'green' : 'gray'} variant="light">{family.isActive ? 'Active' : 'Inactive'}</Badge></Table.Td>
                        <Table.Td><Button size="xs" variant="light" onClick={() => handleEditFamily(family)}>Edit</Button></Table.Td>
                      </Table.Tr>
                    ))}
                    {!families.length ? (
                      <Table.Tr><Table.Td colSpan={4}><Text ta="center" c="dimmed" py="lg">No families configured yet.</Text></Table.Td></Table.Tr>
                    ) : null}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="visibility" pt="md">
          <Stack gap="md">
            <Alert color="blue" title="Dealer Catalog Views">
              A catalog view is the dealer-facing context that controls products, files, branding, and portal presentation. Affinity, ownership/PE, independent status, region, and private-label eligibility decide the right view. Pricing stays separate.
            </Alert>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Metric label="Catalog Views With Products" value={catalogViewRows.filter((row) => row.productCount > 0).length} />
              <Metric label="Products With View Rules" value={visibilityRows.filter((row) => row.isVisible).length} />
              <Metric label="Products Missing View" value={visibilityRows.filter((row) => !row.isVisible).length} />
            </SimpleGrid>
            <Paper withBorder p="md">
              <Group justify="space-between" align="flex-start" mb="sm">
                <Stack gap={2}>
                  <Title order={4}>{editingCatalogViewId ? 'Edit Dealer Catalog View' : 'Create Dealer Catalog View'}</Title>
                  <Text size="sm" c="dimmed">
                    Define the dealer-facing catalog contexts first. Products and files can be attached later after product data is validated.
                  </Text>
                </Stack>
                {editingCatalogViewId ? <Button variant="subtle" onClick={resetCatalogViewForm}>New View</Button> : null}
              </Group>
              <SimpleGrid cols={{ base: 1, md: 3 }}>
                <TextInput
                  label="Catalog view name"
                  placeholder="Standard US Dealer Catalog"
                  value={catalogViewForm.name}
                  onChange={(event) => setCatalogViewForm((current) => ({ ...current, name: event.currentTarget.value }))}
                  required
                />
                  <Select
                  label="Audience type"
                  data={CATALOG_VIEW_KIND_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                  value={catalogViewForm.kind}
                  onChange={(value) => {
                    const selected = CATALOG_VIEW_KIND_OPTIONS.find((option) => option.value === value);
                    setCatalogViewForm((current) => ({
                      ...current,
                      kind: (value as DealerCatalogViewSummary['kind'] | null) ?? 'standard',
                      precedence: selected?.precedence ?? current.precedence,
                    }));
                  }}
                  allowDeselect={false}
                />
                <NumberInput
                  label="Rule order"
                  min={1}
                  max={999}
                  value={catalogViewForm.precedence}
                  onChange={(value) => setCatalogViewForm((current) => ({ ...current, precedence: Number(value) || 100 }))}
                />
                <TextInput
                  label="Matching value"
                  placeholder="nexstar, redwood, CA, private-label-code"
                  value={catalogViewForm.resolverKey}
                  onChange={(event) => setCatalogViewForm((current) => ({ ...current, resolverKey: event.currentTarget.value }))}
                />
                <TextInput
                  label="Display label"
                  placeholder="Nexstar, Redwood / Apollo, Canada"
                  value={catalogViewForm.resolverLabel}
                  onChange={(event) => setCatalogViewForm((current) => ({ ...current, resolverLabel: event.currentTarget.value }))}
                />
                <Select
                  label="Region"
                  placeholder="All regions"
                  data={CATEGORY_REGION_OPTIONS}
                  value={catalogViewForm.regionScope || null}
                  onChange={(value) => setCatalogViewForm((current) => ({ ...current, regionScope: value ?? '' }))}
                  searchable
                  clearable
                />
                <TextInput
                  label="Brand / private label"
                  placeholder="Dynamic, dealer brand, private label"
                  value={catalogViewForm.brandLabel}
                  onChange={(event) => setCatalogViewForm((current) => ({ ...current, brandLabel: event.currentTarget.value }))}
                />
                <Switch
                  label="Default eligible dealer view"
                  checked={catalogViewForm.isDefault}
                  onChange={(event) => setCatalogViewForm((current) => ({ ...current, isDefault: event.currentTarget.checked }))}
                  mt="xl"
                />
                <Switch
                  label="Active"
                  checked={catalogViewForm.isActive}
                  onChange={(event) => setCatalogViewForm((current) => ({ ...current, isActive: event.currentTarget.checked }))}
                  mt="xl"
                />
              </SimpleGrid>
              <Textarea
                mt="sm"
                label="Notes"
                minRows={2}
                value={catalogViewForm.description}
                onChange={(event) => setCatalogViewForm((current) => ({ ...current, description: event.currentTarget.value }))}
              />
              <Group justify="space-between" mt="md">
                <Text size="sm" c="dimmed">
                  {CATALOG_VIEW_KIND_OPTIONS.find((option) => option.value === catalogViewForm.kind)?.helper}
                </Text>
                <Group>
                  <Button variant="subtle" onClick={resetCatalogViewForm}>Reset</Button>
                  <Button onClick={handleSaveCatalogView} loading={isSavingCatalogView} disabled={!catalogViewForm.name.trim()}>
                    {editingCatalogViewId ? 'Save Catalog View' : 'Create Catalog View'}
                  </Button>
                </Group>
              </Group>
            </Paper>
            <Paper withBorder>
              {isLoading ? (
                <Group justify="center" p="xl"><Loader /></Group>
              ) : (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Dealer catalog view</Table.Th>
                      <Table.Th>How this view is matched</Table.Th>
                      <Table.Th>Region / Brand</Table.Th>
                      <Table.Th>Products</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {catalogViewRows.map((row) => (
                      <Table.Tr key={row.key}>
                        <Table.Td>
                          <Text fw={600}>{row.catalogView}</Text>
                          <Text size="xs" c="dimmed">{row.isConfigured ? 'Configured catalog view' : 'Needs catalog view setup'}</Text>
                        </Table.Td>
                        <Table.Td>{row.resolverInput}</Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text size="sm">{row.region}</Text>
                            <Text size="xs" c="dimmed">{row.brand}</Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={600}>{row.productCount}</Text>
                          <Text size="xs" c="dimmed">{row.publishedCount} published / {row.blockedCount} missing rules</Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" justify="flex-end">
                            {row.catalogViewId ? (
                              <Button
                                size="xs"
                                variant="light"
                                onClick={() => {
                                  const catalogView = catalogViews.find((item) => item.id === row.catalogViewId);
                                  if (catalogView) handleEditCatalogView(catalogView);
                                }}
                              >
                                Edit View
                              </Button>
                            ) : null}
                            <Button component={Link} href="/product-management?tab=products" size="xs" variant="subtle">Review Products</Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {!catalogViewRows.length ? (
                      <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="lg">No dealer catalog views have product rules yet.</Text></Table.Td></Table.Tr>
                    ) : null}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>
            <Paper withBorder>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>Catalog view rule</Table.Th>
                    <Table.Th>Region / Brand</Table.Th>
                    <Table.Th>Portal status</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {visibilityRows.map((row) => (
                    <Table.Tr key={row.id}>
                      <Table.Td>
                        <Text fw={600}>{row.presentation?.displayName ?? row.product.productName}</Text>
                        <Text size="xs" c="dimmed">{row.product.sku}</Text>
                      </Table.Td>
                      <Table.Td>{row.audience}</Table.Td>
                      <Table.Td>{row.region} / {row.brand}</Table.Td>
                      <Table.Td>
                        <Badge color={row.isVisible ? 'green' : 'red'} variant="light">
                          {row.isVisible ? formatLabel(row.publishStatus) : 'Needs catalog view'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Button component={Link} href={`/product-management/products/${row.product.id}`} size="xs" variant="light">
                          Manage Rule
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {!visibilityRows.length ? (
                    <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="lg">No product visibility rules loaded yet.</Text></Table.Td></Table.Tr>
                  ) : null}
                </Table.Tbody>
              </Table>
            </Paper>
          </Stack>
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
              <Select
                w={220}
                label="Category"
                placeholder="All categories"
                clearable
                searchable
                data={categoryFilterOptions}
                value={categoryFilter}
                onChange={setCategoryFilter}
              />
              <Select
                w={220}
                label="Family"
                placeholder="All families"
                clearable
                searchable
                data={familyFilterOptions}
                value={familyFilter}
                onChange={setFamilyFilter}
              />
              <Select
                w={190}
                label="Publish status"
                placeholder="Any status"
                clearable
                data={publishStatusOptions}
                value={publishStatusFilter}
                onChange={(value) => setPublishStatusFilter(value as ProductPublishStatusKey | null)}
              />
              <Button variant="light" onClick={handlePreviewImport} loading={isPreviewingImport}>
                Preview Legacy Product File
              </Button>
            </Group>
            {importPreview ? (
              <Alert color="blue" title="Legacy product file preview">
                <Text size="sm">
                  {importPreview.uniqueSkus} unique SKUs from {importPreview.acumaticaRows} Acumatica rows and {importPreview.shopifyRows} Shopify rows.
                  {' '}Detected {importPreview.candidateCategories} categories and {importPreview.imageAssets} image assets. Review only: final product load waits for certified Acumatica item mapping.
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
                      <Table.Th>Family</Table.Th>
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
                        <Table.Td>{product.family?.name ?? 'Unassigned'}</Table.Td>
                        <Table.Td><Badge variant="light">{product.sourceSystem}</Badge></Table.Td>
                        <Table.Td>{product.lifecycleStatus}</Table.Td>
                      </Table.Tr>
                    ))}
                    {!products.items.length ? (
                      <Table.Tr><Table.Td colSpan={6}><Text ta="center" c="dimmed" py="lg">No products loaded yet.</Text></Table.Td></Table.Tr>
                    ) : null}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="readiness" pt="md">
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Metric label="Blocked" value={readinessRows.filter((row) => row.status === 'blocked').length} />
              <Metric label="Warnings" value={readinessRows.filter((row) => row.status === 'warning').length} />
              <Metric label="Ready" value={readinessRows.filter((row) => row.status === 'pass').length} />
            </SimpleGrid>
            <Paper withBorder>
              {isLoading ? (
                <Group justify="center" p="xl"><Loader /></Group>
              ) : (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Product</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Blocking Gaps</Table.Th>
                      <Table.Th>Warnings</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {readinessRows.map((row) => (
                      <Table.Tr key={row.product.id}>
                        <Table.Td>
                          <Text fw={600}>{row.presentation?.displayName ?? row.product.productName}</Text>
                          <Text size="xs" c="dimmed">{row.product.sku}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={row.status === 'pass' ? 'green' : row.status === 'warning' ? 'yellow' : 'red'} variant="light">
                            {row.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{row.blockers.join(', ') || 'None'}</Table.Td>
                        <Table.Td>{row.warnings.join(', ') || 'None'}</Table.Td>
                        <Table.Td>
                          <Button component={Link} href={`/product-management/products/${row.product.id}`} size="xs" variant="light">
                            Open
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {!readinessRows.length ? (
                      <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="lg">No products match the current filters.</Text></Table.Td></Table.Tr>
                    ) : null}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="publish" pt="md">
          <Paper withBorder>
            {isLoading ? (
              <Group justify="center" p="xl"><Loader /></Group>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>Presentation Status</Table.Th>
                    <Table.Th>Readiness</Table.Th>
                    <Table.Th>Catalog View Assignments</Table.Th>
                    <Table.Th>Assets</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {publishRows.map((row) => (
                    <Table.Tr key={row.product.id}>
                      <Table.Td>
                        <Text fw={600}>{row.presentation?.displayName ?? row.product.productName}</Text>
                        <Text size="xs" c="dimmed">{row.product.sku}</Text>
                      </Table.Td>
                      <Table.Td><Badge variant="light">{row.presentation?.publishStatus ?? 'draft'}</Badge></Table.Td>
                      <Table.Td>
                        <Badge color={row.readinessStatus === 'pass' ? 'green' : row.readinessStatus === 'warning' ? 'yellow' : 'red'} variant="light">
                          {row.readinessStatus}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{row.visibilityCount}</Table.Td>
                      <Table.Td>{row.assetCount}</Table.Td>
                      <Table.Td>
                        <Button component={Link} href={`/product-management/products/${row.product.id}`} size="xs" variant="light">
                          Review
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {!publishRows.length ? (
                    <Table.Tr><Table.Td colSpan={6}><Text ta="center" c="dimmed" py="lg">No products match the current filters.</Text></Table.Td></Table.Tr>
                  ) : null}
                </Table.Tbody>
              </Table>
            )}
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

function formatLabel(value: string) {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatCatalogAudience(dealerGroupType: string, dealerGroupId?: string) {
  const suffix = dealerGroupId ? `: ${dealerGroupId}` : '';
  switch (dealerGroupType) {
    case 'all_dealers':
      return 'Standard dealers';
    case 'affinity_group':
      return `Affinity catalog view${suffix}`;
    case 'ownership_group':
      return `Ownership / PE catalog view${suffix}`;
    case 'brand':
    case 'private_label':
      return `Brand / private-label catalog view${suffix}`;
    case 'region':
      return `Regional catalog view${suffix}`;
    default:
      return `${formatLabel(dealerGroupType)}${suffix}`;
  }
}

function buildResolverInputLabel(catalogView: string) {
  const lowerView = catalogView.toLowerCase();
  if (lowerView.includes('affinity')) return 'Affinity + portal eligibility';
  if (lowerView.includes('ownership') || lowerView.includes('pe')) return 'Ownership/PE + portal eligibility';
  if (lowerView.includes('brand') || lowerView.includes('private')) return 'Brand/private label + account context';
  if (lowerView.includes('regional')) return 'Region + country/currency context';
  if (lowerView.includes('standard')) return 'Default eligible dealer context';
  if (lowerView.includes('no visibility')) return 'Missing resolved catalog context';
  return 'Resolved dealer/account context';
}

function buildCatalogViewResolverLabel(catalogView: DealerCatalogViewSummary) {
  if (catalogView.resolverLabel) return catalogView.resolverLabel;
  if (catalogView.resolverKey) return catalogView.resolverKey;
  if (catalogView.kind === 'standard') return 'Default eligible dealer context';
  if (catalogView.kind === 'independent') return 'Independent classification outcome';
  if (catalogView.kind === 'region') return catalogView.regionScope ?? 'Region match';
  if (catalogView.kind === 'brand' || catalogView.kind === 'private_label') return catalogView.brandLabel ?? 'Brand/private-label match';
  if (catalogView.kind === 'affinity') return 'Affinity group match';
  if (catalogView.kind === 'ownership') return 'Ownership / PE match';
  return 'Account-specific override';
}

function emptyToNull(value: string) {
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}
