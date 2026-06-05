'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Checkbox, Group, Loader, Modal, Paper, SegmentedControl, Select, SimpleGrid, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { IconAlertTriangle, IconArrowLeft, IconLink, IconRefresh, IconShieldCheck, IconUnlink } from '@tabler/icons-react';
import {
  type DigitalAssetSummary,
  type ProductAssetRoleKey,
} from '@pulse/contracts/digital-assets';
import {
  type DealerCatalogViewSummary,
  type ProductDetail,
  type ProductPublishStatusKey,
} from '@pulse/contracts/product-management';
import {
  assignDigitalAssetToProduct,
  createProductCatalogInclusion,
  fetchDealerCatalogViews,
  fetchDigitalAssetLibrary,
  fetchProductManagementProductDetail,
  unlinkDigitalAssetFromProduct,
  updateProductCatalogInclusion,
  updateProductManagementPresentation,
  validateProductManagementPresentation,
} from '@/lib/pulse-api';
import { EmptyStateMessage, WorkbenchAdvancedSection, WorkbenchAttentionPanel, WorkbenchHeader, WorkbenchMetricStrip, WorkbenchMoreMenu, WorkbenchTable } from '@/components/ui/Workbench';
import { canPerformAction } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';

type PresentationFormState = {
  displayName: string;
  shortDescription: string;
  longDescription: string;
  specSummary: string;
  regionScope: string;
  brandLabel: string;
  publishStatus: ProductPublishStatusKey;
};

type InclusionFormState = {
  dealerCatalogViewId: string | null;
  dealerGroupType: string;
  dealerGroupId: string;
  regionScope: string;
  brandLabel: string;
  isVisible: boolean;
  publishStatus: ProductPublishStatusKey;
  notes: string;
};

type ProductDetailBoardSection = 'content' | 'files' | 'visibility' | 'checks';

const emptyPresentationForm: PresentationFormState = {
  displayName: '',
  shortDescription: '',
  longDescription: '',
  specSummary: '',
  regionScope: '',
  brandLabel: '',
  publishStatus: 'draft',
};

const emptyInclusionForm: InclusionFormState = {
  dealerCatalogViewId: null,
  dealerGroupType: 'all_dealers',
  dealerGroupId: '',
  regionScope: '',
  brandLabel: '',
  isVisible: true,
  publishStatus: 'draft',
  notes: '',
};

const PRODUCT_ASSET_ROLE_OPTIONS: ProductAssetRoleKey[] = [
  'primary_image',
  'gallery_image',
  'spec_sheet',
  'install_guide',
  'brochure',
  'safety_data',
  'video',
  'training',
  'other',
];
const PRODUCT_PUBLISH_STATUS_OPTIONS: ProductPublishStatusKey[] = ['draft', 'ready_for_review', 'approved', 'published', 'blocked', 'archived'];
const CATALOG_VIEW_TYPE_OPTIONS = [
  { value: 'all_dealers', label: 'Standard dealers' },
  { value: 'region', label: 'Regional audience' },
  { value: 'affinity_group', label: 'Approved relationship audience' },
  { value: 'ownership_group', label: 'Ownership group audience' },
  { value: 'brand', label: 'Brand audience' },
  { value: 'private_label', label: 'Private-label audience' },
];

export function ProductDetailWorkspace({ productId }: { productId: string }) {
  const { apiBaseUrl, auth } = usePulseSession();
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [catalogViews, setCatalogViews] = useState<DealerCatalogViewSummary[]>([]);
  const [availableAssets, setAvailableAssets] = useState<DigitalAssetSummary[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetRole, setSelectedAssetRole] = useState<ProductAssetRoleKey>('primary_image');
  const [presentationForm, setPresentationForm] = useState<PresentationFormState>(emptyPresentationForm);
  const [inclusionForm, setInclusionForm] = useState<InclusionFormState>(emptyInclusionForm);
  const [editingInclusionId, setEditingInclusionId] = useState<string | null>(null);
  const [isInclusionFormOpen, setIsInclusionFormOpen] = useState(false);
  const [isPresentationFormOpen, setIsPresentationFormOpen] = useState(false);
  const [isAssetAttachOpen, setIsAssetAttachOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigningAsset, setIsAssigningAsset] = useState(false);
  const [unlinkingAssignmentId, setUnlinkingAssignmentId] = useState<string | null>(null);
  const [isSavingPresentation, setIsSavingPresentation] = useState(false);
  const [isSavingInclusion, setIsSavingInclusion] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [activeBoardSection, setActiveBoardSection] = useState<ProductDetailBoardSection>('content');
  const canManageProducts = auth ? canPerformAction(auth.identity.role, 'product.manage') : false;
  const canPublishProducts = auth ? canPerformAction(auth.identity.role, 'product.publish') : false;
  const canLinkProductAssets = auth ? canPerformAction(auth.identity.role, 'product.asset_link') : false;
  const approvedAttachableAssets = availableAssets.filter((asset) => (
    asset.status === 'active'
    && asset.reviewStatus === 'approved'
    && Boolean(asset.currentVersion)
  ));

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [response, assetLibrary, catalogViewResponse] = await Promise.all([
          fetchProductManagementProductDetail(apiBaseUrl, auth.tokens.accessToken, productId),
          fetchDigitalAssetLibrary(apiBaseUrl, auth.tokens.accessToken, { limit: 100 }),
          fetchDealerCatalogViews(apiBaseUrl, auth.tokens.accessToken, { isActive: true }),
        ]);
        if (!cancelled) setProduct(response);
        if (!cancelled) setAvailableAssets(assetLibrary.items);
        if (!cancelled) setCatalogViews(catalogViewResponse.items);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, productId]);

  const reloadProduct = async () => {
    if (!auth) return;
    const [response, catalogViewResponse] = await Promise.all([
      fetchProductManagementProductDetail(apiBaseUrl, auth.tokens.accessToken, productId),
      fetchDealerCatalogViews(apiBaseUrl, auth.tokens.accessToken, { isActive: true }),
    ]);
    setProduct(response);
    setCatalogViews(catalogViewResponse.items);
  };

  useEffect(() => {
    const presentation = product?.presentations[0];
    if (!presentation) return;
    setPresentationForm({
      displayName: presentation.displayName,
      shortDescription: presentation.shortDescription ?? '',
      longDescription: presentation.longDescription ?? '',
      specSummary: presentation.specSummary ?? '',
      regionScope: presentation.regionScope ?? '',
      brandLabel: presentation.brandLabel ?? '',
      publishStatus: presentation.publishStatus,
    });
  }, [product?.presentations]);

  const handleAssignAsset = async () => {
    if (!auth || !product || !selectedAssetId) return;
    const presentation = product.presentations[0];
    if (!presentation) return;
    const asset = availableAssets.find((item) => item.id === selectedAssetId);
    const roleSortOrder = product.assetAssignments.filter((assignment) => assignment.role === selectedAssetRole).length + 1;
    setIsAssigningAsset(true);
    setAssetError(null);
    try {
      await assignDigitalAssetToProduct(apiBaseUrl, auth.tokens.accessToken, {
        presentationId: presentation.id,
        assetId: selectedAssetId,
        assetVersionId: asset?.currentVersionId ?? null,
        role: selectedAssetRole,
        brandLabel: presentation.brandLabel ?? asset?.brandScope ?? null,
        regionScope: presentation.regionScope ?? asset?.regionScope ?? null,
        sortOrder: selectedAssetRole === 'primary_image' ? 10 : 100 + roleSortOrder,
        isRequired: selectedAssetRole === 'primary_image' || selectedAssetRole === 'spec_sheet',
      });
      setSelectedAssetId(null);
      setIsAssetAttachOpen(false);
      await reloadProduct();
    } catch (assignError) {
      setAssetError(assignError instanceof Error ? assignError.message : String(assignError));
    } finally {
      setIsAssigningAsset(false);
    }
  };

  const handleUnlinkAsset = async (assignmentId: string) => {
    if (!auth) return;
    setUnlinkingAssignmentId(assignmentId);
    setAssetError(null);
    try {
      await unlinkDigitalAssetFromProduct(apiBaseUrl, auth.tokens.accessToken, assignmentId);
      await reloadProduct();
    } catch (unlinkError) {
      setAssetError(unlinkError instanceof Error ? unlinkError.message : String(unlinkError));
    } finally {
      setUnlinkingAssignmentId(null);
    }
  };

  const handleValidatePresentation = async () => {
    if (!auth || !product?.presentations[0]) return;
    setIsValidating(true);
    setAssetError(null);
    try {
      await validateProductManagementPresentation(apiBaseUrl, auth.tokens.accessToken, product.presentations[0].id);
      await reloadProduct();
    } catch (validationError) {
      setAssetError(validationError instanceof Error ? validationError.message : String(validationError));
    } finally {
      setIsValidating(false);
    }
  };

  const handleSavePresentation = async () => {
    if (!auth || !primaryPresentation) return;
    setIsSavingPresentation(true);
    setAssetError(null);
    try {
      await updateProductManagementPresentation(apiBaseUrl, auth.tokens.accessToken, primaryPresentation.id, {
        displayName: presentationForm.displayName,
        shortDescription: emptyToNull(presentationForm.shortDescription),
        longDescription: emptyToNull(presentationForm.longDescription),
        specSummary: emptyToNull(presentationForm.specSummary),
        regionScope: emptyToNull(presentationForm.regionScope),
        brandLabel: emptyToNull(presentationForm.brandLabel),
        publishStatus: presentationForm.publishStatus,
      });
      setIsPresentationFormOpen(false);
      await reloadProduct();
    } catch (saveError) {
      setAssetError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSavingPresentation(false);
    }
  };

  const handleEditInclusion = (inclusion: ProductDetail['inclusions'][number]) => {
    setEditingInclusionId(inclusion.id);
    setInclusionForm({
      dealerCatalogViewId: inclusion.dealerCatalogViewId ?? null,
      dealerGroupType: inclusion.dealerGroupType,
      dealerGroupId: inclusion.dealerGroupId ?? '',
      regionScope: inclusion.regionScope ?? '',
      brandLabel: inclusion.brandLabel ?? '',
      isVisible: inclusion.isVisible,
      publishStatus: inclusion.publishStatus,
      notes: inclusion.notes ?? '',
    });
    setIsInclusionFormOpen(true);
  };

  const handleResetInclusion = () => {
    setEditingInclusionId(null);
    setInclusionForm(emptyInclusionForm);
    setIsInclusionFormOpen(false);
  };

  const handleSaveInclusion = async () => {
    if (!auth || !primaryPresentation) return;
    setIsSavingInclusion(true);
    setAssetError(null);
    const payload = {
      presentationId: primaryPresentation.id,
      dealerCatalogViewId: inclusionForm.dealerCatalogViewId,
      dealerGroupType: inclusionForm.dealerGroupType,
      dealerGroupId: emptyToNull(inclusionForm.dealerGroupId),
      regionScope: emptyToNull(inclusionForm.regionScope),
      brandLabel: emptyToNull(inclusionForm.brandLabel),
      isVisible: inclusionForm.isVisible,
      publishStatus: inclusionForm.publishStatus,
      notes: emptyToNull(inclusionForm.notes),
    };
    try {
      if (editingInclusionId) {
        await updateProductCatalogInclusion(apiBaseUrl, auth.tokens.accessToken, editingInclusionId, payload);
      } else {
        await createProductCatalogInclusion(apiBaseUrl, auth.tokens.accessToken, payload);
      }
      handleResetInclusion();
      await reloadProduct();
    } catch (saveError) {
      setAssetError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSavingInclusion(false);
    }
  };

  if (isLoading) {
    return <Group justify="center" p="xl"><Loader /></Group>;
  }

  if (error) {
    return (
      <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Product detail unavailable">
        {error}
      </Alert>
    );
  }

  if (!product) {
    return <Text c="dimmed">Product not loaded.</Text>;
  }

  const primaryPresentation = product.presentations[0];
  const blockedChecks = product.readinessChecks.filter((check) => check.status === 'blocked');
  const assetRoleOptions = PRODUCT_ASSET_ROLE_OPTIONS.map((role) => ({ value: role, label: formatLabel(role) }));
  const publishStatusOptions = PRODUCT_PUBLISH_STATUS_OPTIONS.filter((status) => status !== 'published').map((status) => ({ value: status, label: formatLabel(status) }));
  const catalogViewOptions = catalogViews.map((catalogView) => ({
    value: catalogView.id,
    label: catalogView.resolverLabel ? `${catalogView.name} - ${catalogView.resolverLabel}` : catalogView.name,
  }));
  const visibleDealerViewCount = product.inclusions.filter((inclusion) => inclusion.isVisible).length;
  const canRunReadiness = canPublishProducts && Boolean(primaryPresentation);
  const needsContent = !primaryPresentation || !primaryPresentation.shortDescription;
  const needsFiles = product.assetAssignments.length === 0;
  const needsVisibility = visibleDealerViewCount === 0;
  const productAttentionItems = [
    ...(needsContent ? [{
      id: 'catalog-content',
      title: 'Dealer-facing content',
      description: 'Add the approved product name and description dealers will see.',
      count: 1,
      tone: 'orange' as const,
    }] : []),
    ...(!product.assetAssignments.length ? [{
      id: 'product-files',
      title: 'Product files',
      description: 'Attach at least one approved image, brochure, spec sheet, or install guide.',
      count: 1,
      tone: 'orange' as const,
    }] : []),
    ...(!visibleDealerViewCount ? [{
      id: 'dealer-visibility',
      title: 'Dealer group',
      description: 'Choose which dealer group can see this product and its files.',
      count: 1,
      tone: 'orange' as const,
    }] : []),
    ...blockedChecks.slice(0, 3).map((check) => ({
      id: `readiness-${check.id}`,
      title: check.checkName,
      description: check.message ?? 'Review this readiness check before publishing.',
      count: 1,
      tone: 'red' as const,
    })),
  ];
  const productMetrics = [
    { label: 'Category', value: product.category?.name ?? 'Unassigned', tone: product.category ? 'blue' as const : 'orange' as const },
    { label: 'Family', value: product.family?.name ?? 'Unassigned', tone: product.family ? 'blue' as const : 'orange' as const },
    { label: 'Files', value: product.assetAssignments.length, tone: product.assetAssignments.length ? 'green' as const : 'orange' as const },
    { label: 'Dealer groups', value: visibleDealerViewCount, tone: visibleDealerViewCount ? 'green' as const : 'orange' as const },
  ];
  const openAddDealerCatalogView = () => {
    setEditingInclusionId(null);
    setInclusionForm(emptyInclusionForm);
    setIsInclusionFormOpen(true);
    setActiveBoardSection('visibility');
  };
  const detailPrimaryAction = needsContent && canManageProducts ? (
    <Button variant="filled" onClick={() => {
      setActiveBoardSection('content');
      setIsPresentationFormOpen(true);
    }}>
      Fix product info
    </Button>
  ) : needsFiles && canLinkProductAssets ? (
    <Button variant="filled" leftSection={<IconLink size={16} />} onClick={() => {
      setActiveBoardSection('files');
      setIsAssetAttachOpen(true);
    }}>
      Attach approved file
    </Button>
  ) : needsVisibility && canManageProducts && primaryPresentation ? (
    <Button variant="filled" leftSection={<IconShieldCheck size={16} />} onClick={openAddDealerCatalogView}>
      Set visibility
    </Button>
  ) : canRunReadiness ? (
    <Button variant="filled" leftSection={<IconRefresh size={16} />} onClick={handleValidatePresentation} loading={isValidating}>
      Run publish check
    </Button>
  ) : null;

  return (
    <Stack gap="lg">
      <WorkbenchHeader
        eyebrow="Product detail"
        title={primaryPresentation?.displayName ?? product.productName}
        description={primaryPresentation?.shortDescription ?? primaryPresentation?.specSummary ?? 'Review dealer-facing content, files, visibility, and readiness before publishing.'}
        policyText={`SKU ${product.sku} · ${formatLabel(product.lifecycleStatus)} · ${primaryPresentation?.readyForDealerPortal ? 'Ready for dealer portal' : 'Needs readiness review'}`}
        primaryAction={detailPrimaryAction}
        secondaryActions={(
          <Group gap="xs">
            <Button component={Link} href="/product-management?tab=products" variant="default" leftSection={<IconArrowLeft size={16} />}>
              Back to Products
            </Button>
            <WorkbenchMoreMenu
              items={[
                ...(canManageProducts ? [{
                  id: 'edit-content',
                  label: 'Fix product info',
                  onClick: () => setIsPresentationFormOpen(true),
                }] : []),
                ...(canLinkProductAssets ? [{
                  id: 'attach-file',
                  label: 'Attach approved file',
                  onClick: () => setIsAssetAttachOpen(true),
                }] : []),
                ...(canManageProducts && primaryPresentation ? [{
                  id: 'add-dealer-view',
                  label: 'Set visibility',
                  onClick: openAddDealerCatalogView,
                }] : []),
                {
                  id: 'catalog-views',
                  label: 'Manage dealer groups',
                  onClick: () => router.push('/product-management?tab=visibility'),
                },
              ]}
            />
          </Group>
        )}
      />

      <WorkbenchMetricStrip metrics={productMetrics} />

      {productAttentionItems.length > 0 ? (
        <WorkbenchAttentionPanel
          title="Readiness summary"
          description="Publish blockers and missing dealer-facing work that need attention."
          items={productAttentionItems}
        />
      ) : null}

      <Paper withBorder p="md">
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={2}>
            <Title order={4}>Product publish checklist</Title>
            <Text size="sm" c="dimmed">Fix one part at a time: info, files, visibility, then publish check.</Text>
          </Stack>
          <SegmentedControl
            aria-label="Product readiness sections"
            value={activeBoardSection}
            onChange={(value) => setActiveBoardSection(value as ProductDetailBoardSection)}
            data={[
              { value: 'content', label: 'Info' },
              { value: 'files', label: 'Files' },
              { value: 'visibility', label: 'Visibility' },
              { value: 'checks', label: 'Publish check' },
            ]}
          />
        </Group>
      </Paper>

      {activeBoardSection === 'content' ? (
      <Paper withBorder p="md">
        <Group justify="space-between" mb="sm">
          <Title order={4}>Product info</Title>
          <Badge color={primaryPresentation?.readyForDealerPortal ? 'green' : 'gray'}>{formatLabel(primaryPresentation?.publishStatus ?? 'draft')}</Badge>
        </Group>
        <Text>{primaryPresentation?.shortDescription ?? 'Dealer-facing description still needs approval.'}</Text>
      </Paper>
      ) : null}

      {primaryPresentation && canManageProducts ? (
        <Modal
          opened={isPresentationFormOpen}
          onClose={() => setIsPresentationFormOpen(false)}
          title="Fix product info"
          size="xl"
          centered
        >
          <Stack gap="sm" mt="md">
            <Text size="sm" c="dimmed">Update the dealer-facing name, copy, and review status. Region and brand labels only apply when this presentation is scoped.</Text>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput label="Display name" value={presentationForm.displayName} onChange={(event) => setPresentationForm((current) => ({ ...current, displayName: event.currentTarget.value }))} />
              <Select label="Review status" data={publishStatusOptions} value={presentationForm.publishStatus} onChange={(value) => setPresentationForm((current) => ({ ...current, publishStatus: (value as ProductPublishStatusKey | null) ?? 'draft' }))} allowDeselect={false} />
            </SimpleGrid>
            <Textarea label="Short description" minRows={2} value={presentationForm.shortDescription} onChange={(event) => setPresentationForm((current) => ({ ...current, shortDescription: event.currentTarget.value }))} />
            <Textarea label="Long description" minRows={3} value={presentationForm.longDescription} onChange={(event) => setPresentationForm((current) => ({ ...current, longDescription: event.currentTarget.value }))} />
            <Textarea label="Spec summary" minRows={2} value={presentationForm.specSummary} onChange={(event) => setPresentationForm((current) => ({ ...current, specSummary: event.currentTarget.value }))} />
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput label="Region" value={presentationForm.regionScope} onChange={(event) => setPresentationForm((current) => ({ ...current, regionScope: event.currentTarget.value }))} />
              <TextInput label="Brand / private label" value={presentationForm.brandLabel} onChange={(event) => setPresentationForm((current) => ({ ...current, brandLabel: event.currentTarget.value }))} />
            </SimpleGrid>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setIsPresentationFormOpen(false)}>Cancel</Button>
              <Button onClick={handleSavePresentation} loading={isSavingPresentation}>Save product info</Button>
            </Group>
          </Stack>
        </Modal>
      ) : null}

      {activeBoardSection === 'files' ? (
      <Paper withBorder p="md">
        <Group justify="space-between" mb="sm" align="flex-end">
          <Stack gap={2}>
            <Title order={4}>Approved files</Title>
            <Text c="dimmed" size="sm">Attach approved images, spec sheets, brochures, and install guides to the dealer-facing product presentation.</Text>
          </Stack>
        </Group>

        {assetError ? (
          <Alert color="yellow" icon={<IconAlertTriangle size={18} />} mb="sm">
            {assetError}
          </Alert>
        ) : null}

        <WorkbenchTable<ProductDetail['assetAssignments'][number]>
          ariaLabel="Product files"
          rows={product.assetAssignments}
          getRowKey={(assignment) => assignment.id}
          minWidth={760}
          withContainer={false}
          columns={[
            {
              key: 'file',
              header: 'File',
              render: (assignment) => (
                <Stack gap={2}>
                  <Text fw={600}>{assignment.title}</Text>
                  <Text size="xs" c="dimmed">Linked file</Text>
                </Stack>
              ),
            },
            {
              key: 'use',
              header: 'Use',
              render: (assignment) => (
                <Stack gap={2}>
                  <Text fw={600}>{formatLabel(assignment.role)}</Text>
                  <Text size="xs" c="dimmed">{formatLabel(assignment.kind)}</Text>
                </Stack>
              ),
            },
            {
              key: 'scope',
              header: 'Scope',
              render: (assignment) => [assignment.brandScope, assignment.regionScope].filter(Boolean).join(' / ') || 'Unscoped',
            },
            {
              key: 'status',
              header: 'Status',
              render: (assignment) => (
                <Stack gap={2}>
                  <Badge variant="light">{formatLabel(assignment.status)} / {formatLabel(assignment.reviewStatus)}</Badge>
                  <Text size="xs" c="dimmed">{assignment.isRequired ? 'Required before publish' : 'Optional for publish'}</Text>
                </Stack>
              ),
            },
          ]}
          {...(canLinkProductAssets ? { rowActions: (assignment: ProductDetail['assetAssignments'][number]) => [{
            id: 'unlink-file',
            label: 'Unlink file',
            color: 'danger' as const,
            icon: <IconUnlink size={14} />,
            disabled: unlinkingAssignmentId === assignment.id,
            onClick: () => void handleUnlinkAsset(assignment.id),
          }] } : {})}
          emptyState={(
            <EmptyStateMessage
              kind="no-data"
              title="No product files attached"
              description="Link approved images, spec sheets, brochures, or install guides before publish."
              action={canLinkProductAssets ? (
                <Button size="xs" leftSection={<IconLink size={14} />} onClick={() => setIsAssetAttachOpen(true)}>
                  Attach approved file
                </Button>
              ) : undefined}
            />
          )}
        />
      </Paper>
      ) : null}

      {canLinkProductAssets ? (
        <Modal
          opened={isAssetAttachOpen}
          onClose={() => setIsAssetAttachOpen(false)}
          title="Attach approved file"
          size="lg"
          centered
        >
          <Stack gap="sm">
            <Text size="sm" c="dimmed">Choose an active approved file, then choose how dealers will see it on this product.</Text>
            <Select
              label="File"
              searchable
              clearable
              placeholder={approvedAttachableAssets.length ? 'Select approved file' : 'No approved files available'}
              value={selectedAssetId}
              onChange={setSelectedAssetId}
              data={approvedAttachableAssets.map((asset) => ({
                value: asset.id,
                label: `${asset.title} / ${formatLabel(asset.kind)} / ${asset.currentVersion?.fileName ?? 'current file'}`,
              }))}
            />
            {approvedAttachableAssets.length === 0 ? (
              <Alert color="yellow" variant="light">
                Review all files in Digital Assets to approve a file before attaching it to this product.
              </Alert>
            ) : null}
            <Select
              label="Use as"
              value={selectedAssetRole}
              onChange={(value) => setSelectedAssetRole((value as ProductAssetRoleKey | null) ?? 'primary_image')}
              data={assetRoleOptions}
              allowDeselect={false}
            />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setIsAssetAttachOpen(false)}>Cancel</Button>
              <Button
                leftSection={<IconLink size={16} />}
                onClick={handleAssignAsset}
                disabled={!selectedAssetId || !primaryPresentation}
                loading={isAssigningAsset}
              >
                Attach approved file
              </Button>
            </Group>
          </Stack>
        </Modal>
      ) : null}

      {activeBoardSection === 'visibility' ? (
      <Paper withBorder p="md">
        <Group mb="sm" justify="space-between">
          <Group>
            <IconShieldCheck size={18} />
            <Title order={4}>Visibility</Title>
          </Group>
        </Group>
        <Text c="dimmed" size="sm" mb="sm">
          Dealer groups control who sees this product and its files. Pricing stays separate.
        </Text>
        <WorkbenchTable<ProductDetail['inclusions'][number]>
          ariaLabel="Product dealer visibility"
          rows={product.inclusions}
          getRowKey={(inclusion) => inclusion.id}
          minWidth={760}
          withContainer={false}
          columns={[
            {
              key: 'catalog-view',
              header: 'Dealer group',
              render: (inclusion) => inclusion.dealerCatalogView?.name ?? formatCatalogViewType(inclusion.dealerGroupType),
            },
            {
              key: 'who-sees-it',
              header: 'Who sees it',
              render: (inclusion) => inclusion.dealerCatalogView?.resolverLabel ?? inclusion.dealerGroupId ?? 'Selected catalog audience',
            },
            {
              key: 'scope',
              header: 'Scope',
              render: (inclusion) => (
                <Stack gap={2}>
                  <Text>{inclusion.regionScope ?? 'Any region'}</Text>
                  <Text size="xs" c="dimmed">{inclusion.brandLabel ? `${inclusion.brandLabel} brand/private label` : 'Neutral brand'}</Text>
                </Stack>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (inclusion) => (
                <Badge color={inclusion.isVisible ? 'green' : 'gray'} variant="light">
                  {formatLabel(inclusion.isVisible ? inclusion.publishStatus : 'hidden')}
                </Badge>
              ),
            },
          ]}
          {...(canManageProducts ? { rowActions: (inclusion: ProductDetail['inclusions'][number]) => [{
            id: 'edit-visibility',
            label: 'Edit visibility',
            onClick: () => handleEditInclusion(inclusion),
          }] } : {})}
          emptyState={(
            <EmptyStateMessage
              kind="no-data"
              title="No dealer group selected"
              description="Add this product to at least one dealer group before publish."
              action={canManageProducts && primaryPresentation ? (
                <Button size="xs" leftSection={<IconShieldCheck size={14} />} onClick={openAddDealerCatalogView}>
                  Set visibility
                </Button>
              ) : undefined}
            />
          )}
        />
        {primaryPresentation && canManageProducts ? (
          <Modal
            opened={isInclusionFormOpen}
            onClose={handleResetInclusion}
            title={editingInclusionId ? 'Edit visibility' : 'Set visibility'}
            size="xl"
            centered
          >
          <Stack gap="sm">
            <Text size="sm" c="dimmed">Choose the dealer group, decide if this product is visible there, and set review status.</Text>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Select
                label="Dealer group"
                placeholder="Select an existing dealer group"
                description="Use advanced overrides only for scoped exceptions."
                data={catalogViewOptions}
                value={inclusionForm.dealerCatalogViewId}
                onChange={(value) => setInclusionForm((current) => ({ ...current, dealerCatalogViewId: value }))}
                clearable
              />
              <Select label="Review status" data={publishStatusOptions} value={inclusionForm.publishStatus} onChange={(value) => setInclusionForm((current) => ({ ...current, publishStatus: (value as ProductPublishStatusKey | null) ?? 'draft' }))} allowDeselect={false} />
            </SimpleGrid>
            <Checkbox label="Visible to this dealer group" checked={inclusionForm.isVisible} onChange={(event) => setInclusionForm((current) => ({ ...current, isVisible: event.currentTarget.checked }))} />
            <WorkbenchAdvancedSection
              title="Advanced scope and notes"
              description="Use only when this product needs a region, brand, or catalog-audience override."
            >
              <SimpleGrid cols={{ base: 1, md: 2 }} mt="sm">
                <Select label="Audience override" data={CATALOG_VIEW_TYPE_OPTIONS} value={inclusionForm.dealerGroupType} onChange={(value) => setInclusionForm((current) => ({ ...current, dealerGroupType: value ?? 'all_dealers' }))} allowDeselect={false} />
                <TextInput label="Audience code" placeholder="e.g. Service Experts, Nexstar, Redwood, Canada" value={inclusionForm.dealerGroupId} onChange={(event) => setInclusionForm((current) => ({ ...current, dealerGroupId: event.currentTarget.value }))} />
                <TextInput label="Region" value={inclusionForm.regionScope} onChange={(event) => setInclusionForm((current) => ({ ...current, regionScope: event.currentTarget.value }))} />
                <TextInput label="Brand / private label" value={inclusionForm.brandLabel} onChange={(event) => setInclusionForm((current) => ({ ...current, brandLabel: event.currentTarget.value }))} />
              </SimpleGrid>
              <Textarea label="Notes" minRows={2} mt="sm" value={inclusionForm.notes} onChange={(event) => setInclusionForm((current) => ({ ...current, notes: event.currentTarget.value }))} />
            </WorkbenchAdvancedSection>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={handleResetInclusion}>Cancel</Button>
              <Button onClick={handleSaveInclusion} loading={isSavingInclusion}>{editingInclusionId ? 'Save visibility' : 'Set visibility'}</Button>
            </Group>
          </Stack>
          </Modal>
        ) : null}
      </Paper>
      ) : null}

      {activeBoardSection === 'checks' ? (
      <Paper withBorder p="md">
        <Title order={4} mb="sm">Publish check</Title>
        <WorkbenchTable<ProductDetail['readinessChecks'][number]>
          ariaLabel="Product readiness checks"
          rows={product.readinessChecks}
          getRowKey={(check) => check.id}
          minWidth={720}
          withContainer={false}
          columns={[
            {
              key: 'check',
              header: 'Check',
              render: (check) => check.checkName,
            },
            {
              key: 'status',
              header: 'Status',
              render: (check) => (
                <Badge color={check.status === 'pass' ? 'green' : check.status === 'warning' ? 'yellow' : 'red'}>
                  {check.status}
                </Badge>
              ),
              width: 140,
            },
            {
              key: 'message',
              header: 'Message',
              render: (check) => check.message ?? '-',
            },
          ]}
          emptyState={(
            <EmptyStateMessage
              kind="no-data"
              title="No readiness checks yet"
              description="Run publish validation to generate checks."
              action={canRunReadiness ? (
                <Button size="xs" leftSection={<IconRefresh size={14} />} onClick={handleValidatePresentation} loading={isValidating}>
                  Run publish check
                </Button>
              ) : undefined}
            />
          )}
        />
      </Paper>
      ) : null}

    </Stack>
  );
}

function formatLabel(value: string) {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatCatalogViewType(value: string) {
  return CATALOG_VIEW_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? formatLabel(value);
}

function emptyToNull(value: string) {
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}
