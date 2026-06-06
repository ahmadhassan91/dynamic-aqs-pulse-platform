'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Alert, Badge, Button, Group, Loader, Modal, NumberInput, Paper, Popover, Select, SimpleGrid, Stack, Switch, Tabs, Text, Textarea, TextInput, Title } from '@mantine/core';
import {
  type ProductDetail,
  type DealerCatalogViewSummary,
  type DealerCatalogSnapshotCompareResponse,
  type DealerCatalogSnapshotSummary,
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
  fetchDealerCatalogSnapshotCompare,
  fetchDealerCatalogSnapshots,
  fetchProductManagementFamilies,
  fetchProductManagementProducts,
  previewProductReferenceImport,
  publishDealerCatalogSnapshot,
  rollbackDealerCatalogSnapshot,
  updateDealerCatalogView,
  updateProductManagementCategory,
  updateProductManagementFamily,
  type ListProductsResponse,
  type ProductCategorySummary,
  type ProductFamilySummary,
} from '@/lib/pulse-api';
import { APP_LEAD_REGION_OPTIONS } from '@/lib/lead-form-options';
import { usePulseSession } from '@/lib/pulse-session';
import {
  EmptyStateMessage,
  WorkbenchAdvancedSection,
  WorkbenchDetailRail,
  WorkbenchHeader,
  WorkbenchMetricStrip,
  WorkbenchMoreMenu,
  WorkbenchTable,
} from '@/components/ui/Workbench';
import { canPerformAction } from '@/lib/access';

type ProductTab = 'categories' | 'families' | 'products' | 'visibility' | 'admin';
type CatalogViewWizardStep = 'audience' | 'scope' | 'review';
type ImportPreviewProductRow = ProductReferenceImportPreviewResponse['sampleProducts'][number];
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
  activeSnapshot?: DealerCatalogSnapshotSummary | undefined;
};
type ProductCatalogRow = ListProductsResponse['items'][number];
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
const PRODUCT_TABS: ProductTab[] = ['categories', 'families', 'products', 'visibility', 'admin'];
const CATALOG_VIEW_KIND_OPTIONS: Array<{ value: DealerCatalogViewSummary['kind']; label: string; helper: string; precedence: number }> = [
  { value: 'standard', label: 'Standard dealers', helper: 'Default eligible dealer group', precedence: 100 },
  { value: 'affinity', label: 'Approved relationship dealers', helper: 'Known dealer network or buying-group relationship', precedence: 50 },
  { value: 'ownership', label: 'Ownership group dealers', helper: 'Common-owner relationship overlay', precedence: 40 },
  { value: 'independent', label: 'Independent dealers', helper: 'Dealers without a relationship or ownership overlay', precedence: 80 },
  { value: 'region', label: 'Regional dealers', helper: 'US, Canada, province/state, or region-specific view', precedence: 70 },
  { value: 'brand', label: 'Brand-specific dealers', helper: 'Brand-specific presentation and files', precedence: 30 },
  { value: 'private_label', label: 'Private-label dealers', helper: 'Dealer/private-label presentation layer', precedence: 20 },
  { value: 'account_override', label: 'Account override', helper: 'Specific dealer/account exception', precedence: 10 },
];
const CATEGORY_TYPE_OPTIONS = [
  { value: 'portal_section', label: 'Dealer portal section' },
  { value: 'product_line', label: 'Product line' },
  { value: 'application', label: 'Application / use case' },
  { value: 'brand', label: 'Brand / private label' },
  { value: 'legacy_shopify_collection', label: 'Legacy reference only' },
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
const SETUP_AREA_OPTIONS = [
  { value: 'categories', label: 'Catalog sections' },
  { value: 'families', label: 'SKU families' },
  { value: 'admin', label: 'Source file review' },
];
const CATALOG_VIEW_WIZARD_STEPS: Array<{ value: CatalogViewWizardStep; label: string; helper: string }> = [
  { value: 'audience', label: 'Who is this for?', helper: 'Name the dealer audience.' },
  { value: 'scope', label: 'What should they see?', helper: 'Add region or brand only when needed.' },
  { value: 'review', label: 'Review before publish', helper: 'Confirm visibility before saving.' },
];

export function ProductManagementWorkspace() {
  const { apiBaseUrl, auth } = usePulseSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ProductTab>('products');
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
  const [publishingCatalogViewId, setPublishingCatalogViewId] = useState<string | null>(null);
  const [rollbackSnapshotId, setRollbackSnapshotId] = useState<string | null>(null);
  const [isLoadingSnapshotCompare, setIsLoadingSnapshotCompare] = useState(false);
  const [isSavingFamily, setIsSavingFamily] = useState(false);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ProductReferenceImportPreviewResponse | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCatalogViewId, setEditingCatalogViewId] = useState<string | null>(null);
  const [editingFamilyId, setEditingFamilyId] = useState<string | null>(null);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [isCatalogViewModalOpen, setIsCatalogViewModalOpen] = useState(false);
  const [isFamilyFormOpen, setIsFamilyFormOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [catalogViewForm, setCatalogViewForm] = useState<CatalogViewFormState>(emptyCatalogViewForm);
  const [catalogViewWizardStep, setCatalogViewWizardStep] = useState<CatalogViewWizardStep>('audience');
  const [familyForm, setFamilyForm] = useState<FamilyFormState>(emptyFamilyForm);
  const [selectedSnapshotCatalogView, setSelectedSnapshotCatalogView] = useState<DealerCatalogViewSummary | null>(null);
  const [catalogSnapshots, setCatalogSnapshots] = useState<DealerCatalogSnapshotSummary[]>([]);
  const [snapshotCompare, setSnapshotCompare] = useState<DealerCatalogSnapshotCompareResponse | null>(null);
  const [selectedCatalogViewKey, setSelectedCatalogViewKey] = useState<string | null>(null);
  const canManageProducts = auth ? canPerformAction(auth.identity.role, 'product.manage') : false;
  const canPublishProducts = auth ? canPerformAction(auth.identity.role, 'product.publish') : false;

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
          includeDetail: true,
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
        if (!cancelled) {
          setProducts(productResponse);
          setProductDetails(productResponse.details ?? []);
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
      product.category ? null : 'Missing catalog section',
      hasContent ? null : 'Missing dealer-facing content',
      hasPrimaryImage ? null : 'Missing approved primary image',
      hasDealerVisibility ? null : 'Missing dealer-group visibility',
    ].filter(Boolean) as string[];
    const warnings = [
      product.family ? null : 'No SKU family assigned',
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
  const readinessIssueRows = useMemo(() => readinessRows.filter((row) => row.status !== 'pass'), [readinessRows]);
  const firstReadinessIssue = readinessIssueRows[0];
  const workflowMetrics = useMemo(() => {
    const countByGap = (matcher: (gap: string) => boolean) => readinessRows.filter((row) => {
      const gaps = [...row.blockers, ...row.warnings];
      return gaps.some(matcher);
    }).length;

    return {
      needInfo: countByGap((gap) => gap.includes('content') || gap.includes('catalog section') || gap.includes('SKU family')),
      needFiles: countByGap((gap) => gap.includes('image') || gap.includes('spec sheet') || gap.includes('brochure')),
      needVisibility: countByGap((gap) => gap.includes('dealer-group visibility')),
      readyToPublish: readinessRows.filter((row) => row.status === 'pass').length,
    };
  }, [readinessRows]);
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
        activeSnapshot: catalogView.activeSnapshot,
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
  const selectedCatalogViewRow = selectedCatalogViewKey
    ? catalogViewRows.find((row) => row.key === selectedCatalogViewKey) ?? null
    : null;
  const selectedCatalogView = selectedCatalogViewRow?.catalogViewId
    ? catalogViews.find((item) => item.id === selectedCatalogViewRow.catalogViewId) ?? null
    : null;
  const editingCatalogViewRow = editingCatalogViewId
    ? catalogViewRows.find((row) => row.catalogViewId === editingCatalogViewId) ?? null
    : null;
  const handleSelectCatalogViewRow = (row: CatalogViewRow) => {
    setSelectedCatalogViewKey(row.key);
    if (!row.catalogViewId || selectedSnapshotCatalogView?.id !== row.catalogViewId) {
      setSelectedSnapshotCatalogView(null);
      setCatalogSnapshots([]);
      setSnapshotCompare(null);
    }
  };
  const selectedCatalogVisibilityRows = useMemo(() => {
    if (!selectedCatalogViewRow) {
      return [];
    }

    return visibilityRows.filter((row) => {
      if (selectedCatalogViewRow.catalogViewId) {
        return row.catalogViewId === selectedCatalogViewRow.catalogViewId;
      }

      return `${row.audience}|${row.region}|${row.brand}` === selectedCatalogViewRow.key;
    });
  }, [selectedCatalogViewRow, visibilityRows]);

  const reloadCatalog = async () => {
    if (!auth) return;
    const productQuery = {
      search,
      limit: 100,
      includeDetail: true,
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
    setProducts(productResponse);
    setProductDetails(productResponse.details ?? []);
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
    setIsCategoryFormOpen(true);
    setActiveTab('categories');
  };

  const handleResetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryForm(emptyCategoryForm);
    setIsCategoryFormOpen(false);
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
    setIsFamilyFormOpen(true);
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
    setCatalogViewWizardStep('audience');
    setIsCatalogViewModalOpen(true);
    setActiveTab('visibility');
  };

  const resetCatalogViewForm = () => {
    setEditingCatalogViewId(null);
    setCatalogViewForm(emptyCatalogViewForm);
    setCatalogViewWizardStep('audience');
    setIsCatalogViewModalOpen(false);
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

  const loadCatalogSnapshots = async (catalogView: DealerCatalogViewSummary) => {
    if (!auth) return;
    setSelectedSnapshotCatalogView(catalogView);
    setError(null);
    setIsLoadingSnapshotCompare(true);
    try {
      const [response, compareResponse] = await Promise.all([
        fetchDealerCatalogSnapshots(apiBaseUrl, auth.tokens.accessToken, catalogView.id),
        fetchDealerCatalogSnapshotCompare(apiBaseUrl, auth.tokens.accessToken, catalogView.id),
      ]);
      setCatalogSnapshots(response.items);
      setSnapshotCompare(compareResponse);
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : String(snapshotError));
    } finally {
      setIsLoadingSnapshotCompare(false);
    }
  };

  const handlePublishCatalogSnapshot = async (catalogView: DealerCatalogViewSummary) => {
    if (!auth) return;
    setPublishingCatalogViewId(catalogView.id);
    setError(null);
    try {
      await publishDealerCatalogSnapshot(apiBaseUrl, auth.tokens.accessToken, catalogView.id, {
        notes: 'Published from Product Management screen',
      });
      await reloadCatalog();
      await loadCatalogSnapshots(catalogView);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : String(publishError));
    } finally {
      setPublishingCatalogViewId(null);
    }
  };

  const handleRollbackCatalogSnapshot = async (snapshot: DealerCatalogSnapshotSummary) => {
    if (!auth || !selectedSnapshotCatalogView) return;
    setRollbackSnapshotId(snapshot.id);
    setError(null);
    try {
      await rollbackDealerCatalogSnapshot(apiBaseUrl, auth.tokens.accessToken, selectedSnapshotCatalogView.id, snapshot.id, {
        notes: `Rollback to published v${snapshot.version}`,
      });
      await reloadCatalog();
      await loadCatalogSnapshots(selectedSnapshotCatalogView);
    } catch (rollbackError) {
      setError(rollbackError instanceof Error ? rollbackError.message : String(rollbackError));
    } finally {
      setRollbackSnapshotId(null);
    }
  };

  const handleResetFamilyForm = () => {
    setEditingFamilyId(null);
    setFamilyForm(emptyFamilyForm);
    setIsFamilyFormOpen(false);
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

  const goToProductTab = (nextTab: ProductTab) => {
    setActiveTab(nextTab);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('tab', nextTab);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  const setupAreaHeader = (
    <Group justify="space-between" mb="md" align="flex-end">
      <Stack gap={2}>
        <Title order={4}>Setup</Title>
        <Text size="sm" c="dimmed">
          Setup is where admins maintain catalog sections, SKU families, and source-file review. Dealer access is handled in Who Sees What.
        </Text>
      </Stack>
      <Select
        label="Setup area"
        w={260}
        value={activeTab}
        data={SETUP_AREA_OPTIONS}
        onChange={(value) => goToProductTab((value as ProductTab | null) ?? 'categories')}
        allowDeselect={false}
      />
    </Group>
  );
  const productQueueAction = firstReadinessIssue ? {
    label: 'Fix first product',
    disabled: false,
    onClick: () => router.push(`/product-management/products/${firstReadinessIssue.product.id}`),
  } : products.items.length ? {
    label: 'Review dealer groups',
    disabled: false,
    onClick: () => goToProductTab('visibility'),
  } : {
    label: 'Fix first product',
    disabled: true,
    onClick: () => undefined,
  };

  return (
    <Stack gap="lg">
      <WorkbenchHeader
        title="Product Management"
        description="Decide which approved products, copy, and files each dealer group sees in the Dealer Portal."
        policyText="Products become eligible here; live catalog versions are published from Who Sees What after review."
      />

      <WorkbenchMetricStrip
        metrics={[
          { label: 'Need info', value: workflowMetrics.needInfo, tone: workflowMetrics.needInfo ? 'orange' : 'green' },
          { label: 'Need files', value: workflowMetrics.needFiles, tone: workflowMetrics.needFiles ? 'orange' : 'green' },
          { label: 'Need dealer group', value: workflowMetrics.needVisibility, tone: workflowMetrics.needVisibility ? 'orange' : 'green' },
          { label: 'Ready to publish', value: workflowMetrics.readyToPublish, tone: 'green' },
        ]}
      />

      {error ? (
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Catalog workspace unavailable">
          {error}
        </Alert>
      ) : null}

      <Tabs
        value={activeTab}
        onChange={(value) => {
          const nextTab = (value as ProductTab | null) ?? 'products';
          goToProductTab(nextTab);
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="products" leftSection={<IconPackage size={16} />}>Review products</Tabs.Tab>
          <Tabs.Tab value="visibility" leftSection={<IconShieldCheck size={16} />}>Who Sees What</Tabs.Tab>
          <WorkbenchMoreMenu
            label="More"
            items={[
              {
                id: 'catalog-sections',
                label: 'Catalog sections',
                description: 'Sections dealers use to browse products.',
                onClick: () => goToProductTab('categories'),
              },
              {
                id: 'sku-families',
                label: 'SKU families',
                description: 'Sibling SKUs and variant-like product groups.',
                onClick: () => goToProductTab('families'),
              },
              {
                id: 'source-file-review',
                label: 'Source file review',
                description: 'Preview source files without changing what dealers see.',
                onClick: () => goToProductTab('admin'),
              },
            ]}
          />
        </Tabs.List>

        <Tabs.Panel value="categories" pt="md">
          {setupAreaHeader}
          <Stack gap="md">
            <Paper withBorder p="md">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Title order={4}>Catalog sections</Title>
                  <Text size="sm" c="dimmed">Sections are where products appear when dealers browse. They do not decide who can see a product.</Text>
                </Stack>
                <Button
                  variant={isCategoryFormOpen ? 'default' : 'light'}
                  onClick={() => {
                    if (isCategoryFormOpen) {
                      handleResetCategoryForm();
                    } else {
                      setEditingCategoryId(null);
                      setCategoryForm(emptyCategoryForm);
                      setIsCategoryFormOpen(true);
                    }
                  }}
                >
                  {isCategoryFormOpen ? 'Close Setup' : 'Add Section'}
                </Button>
              </Group>
            </Paper>
            {isLoading ? (
              <Paper withBorder p="xl">
                <Group justify="center"><Loader /></Group>
              </Paper>
            ) : (
              <WorkbenchTable<ProductCategorySummary>
                ariaLabel="Product catalog categories"
                rows={categories}
                getRowKey={(category) => category.id}
                columns={[
                  {
                    key: 'category',
                    header: 'Section',
                    render: (category) => (
                      <Stack gap={2}>
                        <Text fw={600}>{category.name}</Text>
                        <Text size="xs" c="dimmed">{category.code}</Text>
                      </Stack>
                    ),
                  },
                  {
                    key: 'scope',
                    header: 'Scope',
                    render: (category) => (
                      <Stack gap={2}>
                        <Text size="sm">{category.categoryType ?? 'General'}</Text>
                        <Text size="xs" c="dimmed">{category.regionScope ?? 'All regions'}</Text>
                      </Stack>
                    ),
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (category) => (
                      <Badge color={category.isActive ? 'green' : 'gray'} variant="light">{category.isActive ? 'Active' : 'Inactive'}</Badge>
                    ),
                  },
                ]}
                rowActions={(category) => ([{
                  id: 'edit-category',
                  label: 'Edit section',
                  onClick: () => handleEditCategory(category),
                }])}
                emptyState={(
                  <EmptyStateMessage
                    kind="no-data"
                    title="No catalog sections configured yet"
                    description="Add catalog sections when dealer browsing needs a new section."
                  />
                )}
              />
            )}

            {isCategoryFormOpen ? (
              <Paper withBorder p="md" data-testid="product-category-form">
              <Stack gap="sm">
                <Title order={4}>{editingCategoryId ? 'Edit Catalog Section' : 'Create Catalog Section'}</Title>
                <Text size="sm" c="dimmed">Name the catalog section first. Purpose, region, and display order stay in advanced options.</Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label="Code"
                    aria-label="Section code"
                    data-testid="product-category-code"
                    value={categoryForm.code}
                    onChange={(event) => setCategoryForm((current) => ({ ...current, code: event.currentTarget.value }))}
                    required
                  />
                  <TextInput
                    label="Name"
                    aria-label="Section name"
                    data-testid="product-category-name"
                    value={categoryForm.name}
                    onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.currentTarget.value }))}
                    required
                  />
                </SimpleGrid>
                <Select
                  label="Parent section"
                  aria-label="Parent section"
                  clearable
                  data={categoryParentOptions}
                  value={categoryForm.parentId}
                  onChange={(value) => setCategoryForm((current) => ({ ...current, parentId: value }))}
                />
                <Textarea
                  label="Description"
                  aria-label="Section description"
                  data-testid="product-category-description"
                  minRows={3}
                  value={categoryForm.description}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.currentTarget.value }))}
                />
                <WorkbenchAdvancedSection
                  title="Advanced section options"
                  description="Use when a catalog section needs a specific purpose, region, or display order."
                >
                  <Stack gap="sm" mt="sm">
                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                      <Select
                        label="Section purpose"
                        aria-label="Section purpose"
                        placeholder="Choose only when needed"
                        clearable
                        searchable
                        data={CATEGORY_TYPE_OPTIONS}
                        value={categoryForm.categoryType || null}
                        onChange={(value) => setCategoryForm((current) => ({ ...current, categoryType: value ?? '' }))}
                      />
                      <Select
                        label="Section display region"
                        aria-label="Section display region"
                        placeholder="All regions"
                        clearable
                        searchable
                        data={CATEGORY_REGION_OPTIONS}
                        value={categoryForm.regionScope || null}
                        onChange={(value) => setCategoryForm((current) => ({ ...current, regionScope: value ?? '' }))}
                      />
                    </SimpleGrid>
                    <Group align="flex-end">
                      <NumberInput
                        label="Sort order"
                        aria-label="Category sort order"
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
                  </Stack>
                </WorkbenchAdvancedSection>
                <Group justify="flex-end">
                  <Button variant="subtle" onClick={handleResetCategoryForm}>Reset</Button>
                  <Button data-testid="product-category-save" onClick={handleSaveCategory} loading={isSavingCategory}>
                    {editingCategoryId ? 'Save Section' : 'Create Section'}
                  </Button>
                </Group>
              </Stack>
            </Paper>
            ) : null}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="families" pt="md">
          {setupAreaHeader}
          <Stack gap="md">
            <Paper withBorder p="md">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Title order={4}>SKU families</Title>
                  <Text size="sm" c="dimmed">Families group related SKUs. They help staff compare sibling products but do not decide dealer access.</Text>
                </Stack>
                <Button
                  variant={isFamilyFormOpen ? 'default' : 'light'}
                  onClick={() => {
                    if (isFamilyFormOpen) {
                      handleResetFamilyForm();
                    } else {
                      setEditingFamilyId(null);
                      setFamilyForm(emptyFamilyForm);
                      setIsFamilyFormOpen(true);
                    }
                  }}
                >
                  {isFamilyFormOpen ? 'Close Setup' : 'Add SKU Family'}
                </Button>
              </Group>
            </Paper>
            {isLoading ? (
              <Paper withBorder p="xl">
                <Group justify="center"><Loader /></Group>
              </Paper>
            ) : (
              <WorkbenchTable<ProductFamilySummary>
                ariaLabel="Product catalog families"
                rows={families}
                getRowKey={(family) => family.id}
                columns={[
                  {
                    key: 'family',
                    header: 'SKU family',
                    render: (family) => (
                      <Stack gap={2}>
                        <Text fw={600}>{family.name}</Text>
                        <Text size="xs" c="dimmed">{family.code}</Text>
                      </Stack>
                    ),
                  },
                  {
                    key: 'products',
                    header: 'Products',
                    align: 'right',
                    render: (family) => products.items.filter((product) => product.family?.id === family.id).length,
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (family) => (
                      <Badge color={family.isActive ? 'green' : 'gray'} variant="light">{family.isActive ? 'Active' : 'Inactive'}</Badge>
                    ),
                  },
                ]}
                rowActions={(family) => ([{
                  id: 'edit-family',
                  label: 'Edit SKU family',
                  onClick: () => handleEditFamily(family),
                }])}
                emptyState={(
                  <EmptyStateMessage
                    kind="no-data"
                    title="No SKU families configured yet"
                    description="Add SKU families when related products should be grouped together."
                  />
                )}
              />
            )}

            {isFamilyFormOpen ? (
              <Paper withBorder p="md" data-testid="product-family-form">
              <Stack gap="sm">
                <Title order={4}>{editingFamilyId ? 'Edit SKU Family' : 'Create SKU Family'}</Title>
                <Text size="sm" c="dimmed">Name the SKU group dealers and staff will recognize. Display order and status stay in advanced options.</Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label="Code"
                    aria-label="Family code"
                    data-testid="product-family-code"
                    value={familyForm.code}
                    onChange={(event) => setFamilyForm((current) => ({ ...current, code: event.currentTarget.value }))}
                    required
                  />
                  <TextInput
                    label="Name"
                    aria-label="Family name"
                    data-testid="product-family-name"
                    value={familyForm.name}
                    onChange={(event) => setFamilyForm((current) => ({ ...current, name: event.currentTarget.value }))}
                    required
                  />
                </SimpleGrid>
                <Textarea
                  label="Description"
                  aria-label="Family description"
                  data-testid="product-family-description"
                  minRows={3}
                  value={familyForm.description}
                  onChange={(event) => setFamilyForm((current) => ({ ...current, description: event.currentTarget.value }))}
                />
                <WorkbenchAdvancedSection
                  title="Advanced SKU family options"
                  description="Use when a family needs a specific display order or should be hidden from setup lists."
                >
                  <Group align="flex-end" mt="sm">
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
                </WorkbenchAdvancedSection>
                <Group justify="flex-end">
                  <Button variant="subtle" onClick={handleResetFamilyForm}>Reset</Button>
                  <Button data-testid="product-family-save" onClick={handleSaveFamily} loading={isSavingFamily}>{editingFamilyId ? 'Save SKU Family' : 'Create SKU Family'}</Button>
                </Group>
              </Stack>
            </Paper>
            ) : null}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="visibility" pt="md">
          <Stack gap="md">
            <Paper withBorder>
              <Group justify="space-between" align="flex-start" p="md" pb={0}>
                <Stack gap={2}>
                  <Title order={4}>Who Sees What</Title>
                  <Text size="sm" c="dimmed">Choose a dealer group, review the products and files that group will see, then publish only when the preview is clean.</Text>
                </Stack>
                <Group gap="xs">
                  <CatalogVisibilityPlaybookButton />
                  <WorkbenchMoreMenu
                    items={[
                      ...(selectedCatalogView ? [
                        {
                          id: 'review-selected',
                          label: `Review before publish: ${selectedCatalogView.name}`,
                          onClick: () => void loadCatalogSnapshots(selectedCatalogView),
                        },
                        ...(canManageProducts ? [{
                          id: 'edit-selected',
                          label: `Edit ${selectedCatalogView.name}`,
                          onClick: () => handleEditCatalogView(selectedCatalogView),
                        }] : []),
                      ] : []),
                      ...(canManageProducts ? [{
                        id: 'add-dealer-view',
                        label: 'Add dealer group',
                        icon: <IconPackage size={16} />,
                        onClick: () => {
                          setEditingCatalogViewId(null);
                          setCatalogViewForm(emptyCatalogViewForm);
                          setCatalogViewWizardStep('audience');
                          setIsCatalogViewModalOpen(true);
                        },
                      }] : []),
                      {
                        id: 'review-products',
                        label: 'Review products',
                        onClick: () => goToProductTab('products'),
                      },
                      ...(canManageProducts ? [{
                        id: 'advanced-setup',
                        label: 'Open setup',
                        onClick: () => goToProductTab('admin'),
                      }] : []),
                    ]}
                  />
                </Group>
              </Group>
              {isLoading ? (
                <Group justify="center" p="xl"><Loader /></Group>
              ) : (
                <WorkbenchTable<CatalogViewRow>
                  ariaLabel="Dealer groups"
                  rows={catalogViewRows}
                  getRowKey={(row) => row.key}
                  minWidth={880}
                  withContainer={false}
                  onRowClick={handleSelectCatalogViewRow}
                  columns={[
                    {
                      key: 'catalog-view',
                      header: 'Dealer group',
                      render: (row) => (
                        <Stack gap={4}>
                          <Group gap="xs">
                            <Text fw={600}>{row.catalogView}</Text>
                            {selectedCatalogViewRow?.key === row.key ? <Badge color="blue" variant="light">Selected</Badge> : null}
                          </Group>
                          <Text size="xs" c="dimmed">{row.isConfigured ? 'Ready to review' : 'Needs setup'}</Text>
                        </Stack>
                      ),
                    },
                    {
                      key: 'who-sees-it',
                      header: 'Who sees it',
                      render: (row) => row.resolverInput,
                    },
                    {
                      key: 'scope',
                      header: 'Scope',
                      render: (row) => (
                        <Stack gap={2}>
                          <Text size="sm">{row.region}</Text>
                          <Text size="xs" c="dimmed">{row.brand}</Text>
                        </Stack>
                      ),
                    },
                    {
                      key: 'products',
                      header: 'Products',
                      render: (row) => (
                        <Stack gap={2}>
                          <Text fw={600}>{row.productCount}</Text>
                          <Text size="xs" c="dimmed">{row.publishedCount} eligible / {row.blockedCount} not visible in this group</Text>
                        </Stack>
                      ),
                    },
                    {
                      key: 'published-version',
                      header: 'Published version',
                      render: (row) => row.activeSnapshot ? (
                        <Stack gap={2}>
                          <Badge color="green" variant="light">v{row.activeSnapshot.version} live</Badge>
                          <Text size="xs" c="dimmed">
                            {row.activeSnapshot.productCount} products / {row.activeSnapshot.fileCount} files
                          </Text>
                        </Stack>
                      ) : (
                        <Badge color="yellow" variant="light">Not published</Badge>
                      ),
                    },
                  ]}
                  rowActions={(row) => {
                    const catalogView = row.catalogViewId ? catalogViews.find((item) => item.id === row.catalogViewId) : null;
                    return catalogView ? [
                      {
                        id: 'review-catalog-view',
                        label: 'Review before publish',
                        onClick: () => void loadCatalogSnapshots(catalogView),
                      },
                      ...(canManageProducts ? [{
                        id: 'edit-catalog-view',
                        label: 'Edit view',
                        onClick: () => handleEditCatalogView(catalogView),
                      }] : []),
                    ] : [{
                      id: 'select-catalog-view',
                      label: 'Select row',
                      onClick: () => handleSelectCatalogViewRow(row),
                    }];
                  }}
                  emptyState={(
                    <EmptyStateMessage
                      kind="no-data"
                      title="No dealer groups have products yet"
                      description="Create a dealer group, then attach visible products before publishing."
                    />
                  )}
                />
              )}
            </Paper>
            <WorkbenchDetailRail
              title={selectedCatalogViewRow ? `${selectedCatalogViewRow.catalogView} publish checklist` : 'Choose a dealer group'}
              description={selectedCatalogViewRow ? `${selectedCatalogViewRow.resolverInput} - ${selectedCatalogViewRow.region} / ${selectedCatalogViewRow.brand}` : 'Select a dealer group to review publish readiness.'}
              emptyState={(
                <EmptyStateMessage
                  kind="no-data"
                  title="Select a dealer group"
                  description="Product visibility evidence appears here after you choose a dealer group."
                />
              )}
            >
              {selectedCatalogViewRow ? (
                <Stack gap="md">
                  <SimpleGrid cols={{ base: 1, sm: 4 }}>
                    <Metric label="Products shown" value={selectedCatalogViewRow.productCount} />
                    <Metric label="Eligible products" value={selectedCatalogViewRow.publishedCount} />
                    <Metric label="Not visible here" value={selectedCatalogViewRow.blockedCount} />
                    <Metric label="Live version" value={selectedCatalogViewRow.activeSnapshot ? `v${selectedCatalogViewRow.activeSnapshot.version}` : 'None'} />
                  </SimpleGrid>
                  <WorkbenchTable
                    ariaLabel="Selected dealer group product visibility"
                    rows={selectedCatalogVisibilityRows}
                    getRowKey={(row) => row.id}
                    minWidth={760}
                    withContainer={false}
                    columns={[
                      {
                        key: 'product',
                        header: 'Product',
                        render: (row) => (
                          <Stack gap={2}>
                          <Text fw={600}>{row.presentation?.displayName ?? row.product.productName}</Text>
                            <Text size="xs" c="dimmed">{row.product.sku}</Text>
                          </Stack>
                        ),
                      },
                      {
                        key: 'scope',
                        header: 'Scope',
                        render: (row) => `${row.region} / ${row.brand}`,
                      },
                      {
                        key: 'portal-status',
                        header: 'Portal status',
                        render: (row) => (
                          <Badge color={row.isVisible ? 'green' : 'red'} variant="light">
                            {row.isVisible ? formatLabel(row.publishStatus) : 'Not visible here'}
                          </Badge>
                        ),
                      },
                    ]}
                    rowActions={(row) => [{
                      id: 'review-product',
                      label: 'Fix product',
                      onClick: () => router.push(`/product-management/products/${row.product.id}?returnTab=visibility`),
                    }]}
                    emptyState={(
                      <EmptyStateMessage
                        kind="no-data"
                        title="No product visibility rows for this view"
                        description="Attach visible products before publishing this dealer group catalog."
                      />
                    )}
                  />
                </Stack>
              ) : null}
            </WorkbenchDetailRail>
            {selectedSnapshotCatalogView ? (
              <WorkbenchDetailRail
                title="Published versions"
                description={selectedSnapshotCatalogView.name}
                actions={(
                  <Group gap="xs">
                    {canPublishProducts ? (
                      <Button
                        size="xs"
                        disabled={!snapshotCompare || isLoadingSnapshotCompare || publishingCatalogViewId === selectedSnapshotCatalogView.id}
                        loading={publishingCatalogViewId === selectedSnapshotCatalogView.id}
                        onClick={() => void handlePublishCatalogSnapshot(selectedSnapshotCatalogView)}
                      >
                        Publish live catalog
                      </Button>
                    ) : null}
                    <Button variant="subtle" size="xs" onClick={() => {
                      setSelectedSnapshotCatalogView(null);
                      setCatalogSnapshots([]);
                      setSnapshotCompare(null);
                    }}>
                      Close
                    </Button>
                  </Group>
                )}
              >
                <SimpleGrid cols={{ base: 1, sm: 4 }} mb="md">
                  <Metric label="Current Products" value={snapshotCompare?.currentProductCount ?? 0} />
                  <Metric label="Current Files" value={snapshotCompare?.currentFileCount ?? 0} />
                  <Metric label="Changed Products" value={(snapshotCompare?.added.length ?? 0) + (snapshotCompare?.removed.length ?? 0) + (snapshotCompare?.changed.length ?? 0)} />
                  <Metric label="Unchanged" value={snapshotCompare?.unchangedCount ?? 0} />
                </SimpleGrid>
                {isLoadingSnapshotCompare ? (
                  <Group justify="center" p="md"><Loader size="sm" /></Group>
                ) : null}
                {snapshotCompare?.warnings.length ? (
                  <Alert color="yellow" mb="md" title="Publish check">
                    {snapshotCompare.warnings.join(' ')}
                  </Alert>
                ) : null}
                {snapshotCompare ? (
                  <Paper withBorder p="sm" mb="md">
                    <Stack gap="xs">
                      <Text fw={700}>Current draft vs published version</Text>
                      <Text size="sm" c="dimmed">
                        Published v{snapshotCompare.activeSnapshot?.version ?? 'none'} has {snapshotCompare.publishedProductCount} products and {snapshotCompare.publishedFileCount} files.
                        Current draft has {snapshotCompare.currentProductCount} products and {snapshotCompare.currentFileCount} files.
                      </Text>
                      <Group gap="xs">
                        <Badge color="green" variant="light">{snapshotCompare.added.length} added</Badge>
                        <Badge color="red" variant="light">{snapshotCompare.removed.length} removed</Badge>
                        <Badge color="yellow" variant="light">{snapshotCompare.changed.length} changed</Badge>
                      </Group>
                      {[...snapshotCompare.added, ...snapshotCompare.removed, ...snapshotCompare.changed].slice(0, 8).map((item) => (
                        <Text key={`${item.presentationId}-${item.changes.join('-')}`} size="sm">
                          <Text span fw={600}>{item.displayName}</Text>
                          {' '}({item.sku}) - {item.changes.length ? item.changes.join(', ') : item.publishedFileCount === 0 ? 'Added to current draft' : 'Removed from current draft'}
                        </Text>
                      ))}
                    </Stack>
                  </Paper>
                ) : null}
                <WorkbenchTable<DealerCatalogSnapshotSummary>
                  ariaLabel="Dealer group published versions"
                  rows={catalogSnapshots}
                  getRowKey={(snapshot) => snapshot.id}
                  minWidth={760}
                  withContainer={false}
                  columns={[
                    {
                      key: 'version',
                      header: 'Version',
                      render: (snapshot) => (
                        <Group gap="xs">
                          <Text fw={700}>v{snapshot.version}</Text>
                          <Badge color={snapshot.isActive ? 'green' : 'gray'} variant="light">{snapshot.isActive ? 'Live' : 'Archived'}</Badge>
                          {snapshot.rollbackOfSnapshotId ? <Badge color="blue" variant="light">Rollback</Badge> : null}
                        </Group>
                      ),
                    },
                    {
                      key: 'contents',
                      header: 'Catalog contents',
                      render: (snapshot) => `${snapshot.productCount} products / ${snapshot.fileCount} files`,
                    },
                    {
                      key: 'published',
                      header: 'Published',
                      render: (snapshot) => new Date(snapshot.publishedAt).toLocaleString(),
                    },
                    {
                      key: 'notes',
                      header: 'Notes',
                      render: (snapshot) => snapshot.notes ?? 'No notes',
                    },
                  ]}
                  rowActions={(snapshot) => snapshot.isActive ? [] : [{
                    id: 'rollback-snapshot',
                    label: rollbackSnapshotId === snapshot.id ? 'Rolling back...' : 'Roll back to this',
                    disabled: rollbackSnapshotId === snapshot.id,
                    onClick: () => void handleRollbackCatalogSnapshot(snapshot),
                  }]}
                  emptyState={(
                    <EmptyStateMessage
                      kind="no-data"
                      title="No published versions yet"
                      description="Publish when this dealer group catalog is ready."
                    />
                  )}
                />
              </WorkbenchDetailRail>
            ) : null}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="products" pt="md">
          <Stack gap="md">
            <Paper withBorder p="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Title order={4}>Products needing review</Title>
                  <Text size="sm" c="dimmed">
                    {readinessIssueRows.length
                      ? `${readinessIssueRows.length} loaded product${readinessIssueRows.length === 1 ? '' : 's'} need product info, approved files, or dealer-group visibility before publish.`
                      : 'Loaded products are ready to publish when the dealer group review is clean.'}
                  </Text>
                </Stack>
                <Button
                  variant="light"
                  disabled={productQueueAction.disabled}
                  onClick={productQueueAction.onClick}
                >
                  {productQueueAction.label}
                </Button>
              </Group>
            </Paper>
            <Group align="flex-end">
              <TextInput
                style={{ flex: 1 }}
                leftSection={<IconSearch size={16} />}
                placeholder="Search SKU or product name"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
              <Select
                w={220}
                label="Catalog section"
                placeholder="All sections"
                clearable
                searchable
                data={categoryFilterOptions}
                value={categoryFilter}
                onChange={setCategoryFilter}
              />
              <Select
                w={220}
                label="SKU family"
                placeholder="All families"
                clearable
                searchable
                data={familyFilterOptions}
                value={familyFilter}
                onChange={setFamilyFilter}
              />
              <Select
                w={190}
                label="Product review status"
                placeholder="Any status"
                clearable
                data={publishStatusOptions}
                value={publishStatusFilter}
                onChange={(value) => setPublishStatusFilter(value as ProductPublishStatusKey | null)}
              />
            </Group>
            {isLoading ? (
              <Paper withBorder>
                <Group justify="center" p="xl"><Loader /></Group>
              </Paper>
            ) : (
              <WorkbenchTable<ProductCatalogRow>
                ariaLabel="Products and readiness"
                rows={products.items}
                getRowKey={(product) => product.id}
                minWidth={900}
                onRowClick={(product) => router.push(`/product-management/products/${product.id}`)}
                columns={[
                  {
                    key: 'product',
                    header: 'Product',
                    render: (product) => {
                      const readiness = readinessRows.find((row) => row.product.id === product.id);
                      return (
                        <Stack gap={2}>
                          <Text fw={600}>{readiness?.presentation?.displayName ?? product.productName}</Text>
                          <Text size="xs" c="dimmed">{product.sku}</Text>
                        </Stack>
                      );
                    },
                  },
                  {
                    key: 'placement',
                    header: 'Catalog section / SKU family',
                    render: (product) => (
                      <Stack gap={2}>
                        <Text size="sm">{product.category?.name ?? 'Unassigned catalog section'}</Text>
                        <Text size="xs" c="dimmed">{product.family?.name ?? 'No SKU family assigned'}</Text>
                      </Stack>
                    ),
                  },
                  {
                    key: 'readiness',
                    header: 'Publish readiness',
                    render: (product) => {
                      const readiness = readinessRows.find((row) => row.product.id === product.id);
                      return (
                        <Badge color={readiness?.status === 'pass' ? 'green' : readiness?.status === 'warning' ? 'yellow' : 'red'} variant="light">
                          {readiness?.status === 'pass' ? 'Ready to publish' : readiness?.status === 'warning' ? 'Needs review' : 'Cannot publish yet'}
                        </Badge>
                      );
                    },
                  },
                  {
                    key: 'gaps',
                    header: 'Next fix',
                    render: (product) => {
                      const readiness = readinessRows.find((row) => row.product.id === product.id);
                      const gaps = readiness ? [...readiness.blockers, ...readiness.warnings] : [];
                      return gaps.length ? gaps.slice(0, 2).join(', ') : readiness ? 'None' : 'Run readiness checks';
                    },
                  },
                ]}
                rowActions={(product) => [{
                  id: 'review-product',
                  label: 'Fix product',
                  onClick: () => router.push(`/product-management/products/${product.id}`),
                }]}
                emptyState={(
                  <EmptyStateMessage
                    kind="no-data"
                    title="No products loaded yet"
                    description="Product records will appear after the approved source data is loaded."
                  />
                )}
              />
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="admin" pt="md">
          {setupAreaHeader}
          <Stack gap="md">
            <Paper withBorder p="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Title order={4}>Source file review</Title>
                  <Text size="sm" c="dimmed">Preview source product references without changing what dealers see.</Text>
                </Stack>
                <Button variant="light" onClick={handlePreviewImport} loading={isPreviewingImport}>
                  Preview source files
                </Button>
              </Group>
              {importPreview ? (
                <Stack gap="md" mt="md">
                  <Alert color="blue" title="Source preview only">
                    <Text size="sm">
                      {importPreview.uniqueSkus} unique SKUs from {importPreview.acumaticaRows} Acumatica rows and {importPreview.shopifyRows} Shopify rows.
                      {' '}Detected {importPreview.candidateCategories} possible catalog sections and {importPreview.imageAssets} image links. Review only: final product load waits for certified product mapping.
                    </Text>
                  </Alert>
                  {importPreview.warnings.length ? (
                    <Alert color="yellow" title="Source files need review">
                      <Stack gap={4}>
                        {importPreview.warnings.map((warning) => (
                          <Text key={warning} size="sm">{warning}</Text>
                        ))}
                      </Stack>
                    </Alert>
                  ) : null}
                  <WorkbenchTable<ImportPreviewProductRow>
                    ariaLabel="Legacy product source preview"
                    rows={importPreview.sampleProducts}
                    getRowKey={(product) => product.sku}
                    minWidth={820}
                    withContainer={false}
                    columns={[
                      {
                        key: 'sku',
                        header: 'SKU',
                        render: (product) => <Text fw={700} size="sm">{product.sku}</Text>,
                      },
                      {
                        key: 'name',
                        header: 'Source product name',
                        render: (product) => <Text size="sm">{product.name}</Text>,
                      },
                      {
                        key: 'source-systems',
                        header: 'Source systems',
                        render: (product) => (
                          <Group gap={4}>
                            {product.sourceSystems.map((source) => (
                              <Badge key={source} variant="light" color="gray">
                                {formatLabel(source)}
                              </Badge>
                            ))}
                          </Group>
                        ),
                      },
                      {
                        key: 'candidate-category',
                        header: 'Possible section',
                        render: (product) => product.categoryName ?? 'Unmapped',
                      },
                      {
                        key: 'region',
                        header: 'Region',
                        render: (product) => product.regionScope ?? 'All regions',
                      },
                    ]}
                    emptyState={(
                      <EmptyStateMessage
                        kind="no-data"
                        title="No source products in this preview"
                        description="Approved source products will appear after migration files are staged."
                      />
                    )}
                  />
                </Stack>
              ) : null}
            </Paper>
          </Stack>
        </Tabs.Panel>

      </Tabs>

      <Modal
        opened={isCatalogViewModalOpen}
        onClose={resetCatalogViewForm}
        title={editingCatalogViewId ? 'Edit dealer group' : 'Create dealer group'}
        size="xl"
        centered
      >
        <Stack gap="sm" data-testid="dealer-catalog-view-form">
          <SimpleGrid cols={{ base: 1, md: 3 }}>
            {CATALOG_VIEW_WIZARD_STEPS.map((step, index) => {
              const currentIndex = CATALOG_VIEW_WIZARD_STEPS.findIndex((item) => item.value === catalogViewWizardStep);
              const isActive = step.value === catalogViewWizardStep;
              const isComplete = currentIndex > index;
              return (
                <Paper key={step.value} withBorder p="sm" {...(isActive ? { bg: 'blue.0' } : {})}>
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Badge color={isComplete ? 'green' : isActive ? 'blue' : 'gray'} variant="light">{index + 1}</Badge>
                      <Text fw={700} size="sm">{step.label}</Text>
                    </Group>
                    <Text size="xs" c="dimmed">{step.helper}</Text>
                  </Stack>
                </Paper>
              );
            })}
          </SimpleGrid>

          {catalogViewWizardStep === 'audience' ? (
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Start with the dealer context Dynamic staff will recognize. Buying groups, parent/PE ownership, independent dealers, and regional rules stay flexible behind this group.
              </Text>
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <TextInput
                  label="Dealer group name"
                  aria-label="Dealer group name"
                  data-testid="dealer-catalog-view-name"
                  placeholder="Standard US Dealer Catalog"
                  value={catalogViewForm.name}
                  onChange={(event) => setCatalogViewForm((current) => ({ ...current, name: event.currentTarget.value }))}
                  required
                />
                <Select
                  label="Dealer group type"
                  aria-label="Dealer group type"
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
                <TextInput
                  label="Internal staff label"
                  aria-label="Dealer group display label"
                  data-testid="dealer-catalog-display-label"
                  placeholder="Nexstar, Redwood / Apollo, Canada"
                  value={catalogViewForm.resolverLabel}
                  onChange={(event) => setCatalogViewForm((current) => ({ ...current, resolverLabel: event.currentTarget.value }))}
                />
              </SimpleGrid>
            </Stack>
          ) : null}

          {catalogViewWizardStep === 'scope' ? (
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Add only the visible catalog scope. Commercial details stay outside this dealer group.
              </Text>
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <Select
                  label="Region"
                  aria-label="Dealer group region"
                  placeholder="All regions"
                  data={CATEGORY_REGION_OPTIONS}
                  value={catalogViewForm.regionScope || null}
                  onChange={(value) => setCatalogViewForm((current) => ({ ...current, regionScope: value ?? '' }))}
                  searchable
                  clearable
                />
                <TextInput
                  label="Brand / private label"
                  aria-label="Dealer group brand or private label"
                  data-testid="dealer-catalog-brand-label"
                  placeholder="Dynamic, dealer brand, private label"
                  value={catalogViewForm.brandLabel}
                  onChange={(event) => setCatalogViewForm((current) => ({ ...current, brandLabel: event.currentTarget.value }))}
                />
              </SimpleGrid>
              <Textarea
                label="Notes"
                aria-label="Dealer group notes"
                data-testid="dealer-catalog-notes"
                minRows={2}
                value={catalogViewForm.description}
                onChange={(event) => setCatalogViewForm((current) => ({ ...current, description: event.currentTarget.value }))}
              />
              <Switch
                label="Active"
                checked={catalogViewForm.isActive}
                onChange={(event) => setCatalogViewForm((current) => ({ ...current, isActive: event.currentTarget.checked }))}
              />
            </Stack>
          ) : null}

          {catalogViewWizardStep === 'review' ? (
            <Stack gap="sm">
              <SimpleGrid cols={{ base: 1, sm: 4 }}>
                <Metric label="Audience" value={catalogViewForm.name || 'Not named'} />
                  <Metric label="Products shown" value={editingCatalogViewRow?.productCount ?? 'New'} />
                <Metric label="Not visible here" value={editingCatalogViewRow?.blockedCount ?? 'Review'} />
                <Metric label="Live version" value={editingCatalogViewRow?.activeSnapshot ? `v${editingCatalogViewRow.activeSnapshot.version}` : 'None'} />
              </SimpleGrid>
              <Paper withBorder p="md">
                <Stack gap="xs">
                  <Text fw={700}>Review summary</Text>
                  <Text size="sm"><Text span fw={600}>Who sees it:</Text> {CATALOG_VIEW_KIND_OPTIONS.find((option) => option.value === catalogViewForm.kind)?.label ?? 'Standard dealers'}</Text>
                  <Text size="sm"><Text span fw={600}>Scope:</Text> {[catalogViewForm.regionScope || 'All regions', catalogViewForm.brandLabel || 'Default brand'].join(' / ')}</Text>
                  <Text size="sm"><Text span fw={600}>Status:</Text> {catalogViewForm.isActive ? 'Active' : 'Inactive'}{catalogViewForm.isDefault ? ' / default eligible' : ''}</Text>
                </Stack>
              </Paper>
              <WorkbenchAdvancedSection
                title="Advanced matching details"
                description="Use when the dealer group needs an explicit priority or account matching code."
              >
                <Stack gap="sm" mt="sm">
                  <Switch
                    label="Default eligible dealer group"
                    checked={catalogViewForm.isDefault}
                    onChange={(event) => setCatalogViewForm((current) => ({ ...current, isDefault: event.currentTarget.checked }))}
                  />
                  <SimpleGrid cols={{ base: 1, md: 2 }}>
                    <NumberInput
                      label="View priority"
                      aria-label="Dealer group priority"
                      description="Lower numbers win when more than one dealer group matches."
                      min={1}
                      max={999}
                      value={catalogViewForm.precedence}
                      onChange={(value) => setCatalogViewForm((current) => ({ ...current, precedence: Number(value) || 100 }))}
                    />
                    <TextInput
                      label="Matching code"
                      aria-label="Dealer group matching value"
                      data-testid="dealer-catalog-matching-value"
                      description="Optional code used by catalog setup."
                      placeholder="nexstar, redwood, CA, private-label-code"
                      value={catalogViewForm.resolverKey}
                      onChange={(event) => setCatalogViewForm((current) => ({ ...current, resolverKey: event.currentTarget.value }))}
                    />
                  </SimpleGrid>
                </Stack>
              </WorkbenchAdvancedSection>
            </Stack>
          ) : null}

          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {CATALOG_VIEW_KIND_OPTIONS.find((option) => option.value === catalogViewForm.kind)?.helper}
            </Text>
            <Group>
              <Button variant="subtle" onClick={resetCatalogViewForm}>Cancel</Button>
              {catalogViewWizardStep !== 'audience' ? (
                <Button
                  variant="default"
                  onClick={() => setCatalogViewWizardStep(catalogViewWizardStep === 'review' ? 'scope' : 'audience')}
                >
                  Back
                </Button>
              ) : null}
              {catalogViewWizardStep !== 'review' ? (
                <Button
                  onClick={() => setCatalogViewWizardStep(catalogViewWizardStep === 'audience' ? 'scope' : 'review')}
                  disabled={catalogViewWizardStep === 'audience' && !catalogViewForm.name.trim()}
                >
                  {catalogViewWizardStep === 'audience' ? 'Next: scope' : 'Review dealer group'}
                </Button>
              ) : (
                <Button data-testid="dealer-catalog-save" onClick={handleSaveCatalogView} loading={isSavingCatalogView} disabled={!catalogViewForm.name.trim()}>
                  {editingCatalogViewId ? 'Save dealer group' : 'Create dealer group'}
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function CatalogVisibilityPlaybookButton() {
  return (
    <Popover width={360} position="bottom-end" shadow="md" withinPortal>
      <Popover.Target>
        <Button variant="light" size="sm">
          Why dealer group first?
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Title order={5}>Dealer group first</Title>
          <Text size="sm">
            Start with the dealer group because it is the storefront a dealer will see in the Dealer Portal.
          </Text>
          <Text size="sm">
            Account labels like affinity, ownership/PE, independent, region, and brand resolve into one dealer group catalog.
          </Text>
          <Text size="sm">
            That dealer group decides the approved products, copy, and files. It does not change the ERP product identity.
          </Text>
          <Text size="sm">
            Price class is pricing context only; it does not decide who sees a product.
          </Text>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
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
      return `Matched dealer group${suffix}`;
    case 'ownership_group':
      return `Ownership dealer group${suffix}`;
    case 'brand':
    case 'private_label':
      return `Brand dealer group${suffix}`;
    case 'region':
      return `Regional dealer group${suffix}`;
    default:
      return `${formatLabel(dealerGroupType)}${suffix}`;
  }
}

function buildResolverInputLabel(catalogView: string) {
  const lowerView = catalogView.toLowerCase();
  if (lowerView.includes('affinity')) return 'Approved relationship + portal eligibility';
  if (lowerView.includes('ownership') || lowerView.includes('pe')) return 'Ownership group + portal eligibility';
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
  if (catalogView.kind === 'affinity') return 'Approved account relationship match';
  if (catalogView.kind === 'ownership') return 'Approved ownership relationship match';
  return 'Account-specific override';
}

function emptyToNull(value: string) {
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}
