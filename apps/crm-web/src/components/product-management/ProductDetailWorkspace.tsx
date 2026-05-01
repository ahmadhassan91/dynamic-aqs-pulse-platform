'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Checkbox, Group, Loader, Paper, Select, SimpleGrid, Stack, Table, Text, Textarea, TextInput, Title } from '@mantine/core';
import { IconAlertTriangle, IconArrowLeft, IconLink, IconRefresh, IconShieldCheck, IconUnlink } from '@tabler/icons-react';
import {
  type DigitalAssetSummary,
  type ProductAssetRoleKey,
} from '@pulse/contracts/digital-assets';
import {
  type ProductDetail,
  type ProductPublishStatusKey,
} from '@pulse/contracts/product-management';
import {
  assignDigitalAssetToProduct,
  createProductCatalogInclusion,
  fetchDigitalAssetLibrary,
  fetchProductManagementProductDetail,
  unlinkDigitalAssetFromProduct,
  updateProductCatalogInclusion,
  updateProductManagementPresentation,
  validateProductManagementPresentation,
} from '@/lib/pulse-api';
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
  dealerGroupType: string;
  dealerGroupId: string;
  regionScope: string;
  brandLabel: string;
  isVisible: boolean;
  publishStatus: ProductPublishStatusKey;
  notes: string;
};

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
  { value: 'region', label: 'Regional catalog view' },
  { value: 'affinity_group', label: 'Affinity catalog view' },
  { value: 'ownership_group', label: 'Ownership / PE catalog view' },
  { value: 'brand', label: 'Brand catalog view' },
  { value: 'private_label', label: 'Private-label catalog view' },
];

export function ProductDetailWorkspace({ productId }: { productId: string }) {
  const { apiBaseUrl, auth } = usePulseSession();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [availableAssets, setAvailableAssets] = useState<DigitalAssetSummary[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetRole, setSelectedAssetRole] = useState<ProductAssetRoleKey>('primary_image');
  const [presentationForm, setPresentationForm] = useState<PresentationFormState>(emptyPresentationForm);
  const [inclusionForm, setInclusionForm] = useState<InclusionFormState>(emptyInclusionForm);
  const [editingInclusionId, setEditingInclusionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigningAsset, setIsAssigningAsset] = useState(false);
  const [unlinkingAssignmentId, setUnlinkingAssignmentId] = useState<string | null>(null);
  const [isSavingPresentation, setIsSavingPresentation] = useState(false);
  const [isSavingInclusion, setIsSavingInclusion] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const canManageProducts = auth ? canPerformAction(auth.identity.role, 'product.manage') : false;

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [response, assetLibrary] = await Promise.all([
          fetchProductManagementProductDetail(apiBaseUrl, auth.tokens.accessToken, productId),
          fetchDigitalAssetLibrary(apiBaseUrl, auth.tokens.accessToken, { limit: 100 }),
        ]);
        if (!cancelled) setProduct(response);
        if (!cancelled) setAvailableAssets(assetLibrary.items);
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
    const response = await fetchProductManagementProductDetail(apiBaseUrl, auth.tokens.accessToken, productId);
    setProduct(response);
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
      dealerGroupType: inclusion.dealerGroupType,
      dealerGroupId: inclusion.dealerGroupId ?? '',
      regionScope: inclusion.regionScope ?? '',
      brandLabel: inclusion.brandLabel ?? '',
      isVisible: inclusion.isVisible,
      publishStatus: inclusion.publishStatus,
      notes: inclusion.notes ?? '',
    });
  };

  const handleResetInclusion = () => {
    setEditingInclusionId(null);
    setInclusionForm(emptyInclusionForm);
  };

  const handleSaveInclusion = async () => {
    if (!auth || !primaryPresentation) return;
    setIsSavingInclusion(true);
    setAssetError(null);
    const payload = {
      presentationId: primaryPresentation.id,
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

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Button component={Link} href="/product-management?tab=products" variant="subtle" leftSection={<IconArrowLeft size={16} />}>
          Products
        </Button>
        <Badge variant="light">{product.sourceSystem}</Badge>
      </Group>

      <Stack gap={4}>
        <Title order={2}>{primaryPresentation?.displayName ?? product.productName}</Title>
        <Text c="dimmed">{product.sku} {product.acumaticaInventoryId ? `| Acumatica ${product.acumaticaInventoryId}` : '| Acumatica link pending'}</Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Paper withBorder p="md">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">Category</Text>
          <Text fw={700}>{product.category?.name ?? 'Unassigned'}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">Lifecycle</Text>
          <Text fw={700}>{product.lifecycleStatus}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">Catalog Go-Live Blockers</Text>
          <Text fw={700}>{blockedChecks.length}</Text>
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="md">
        <Group justify="space-between" mb="sm">
          <Title order={4}>Dealer-Facing Presentation</Title>
          <Group>
            {primaryPresentation ? (
              <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={handleValidatePresentation} loading={isValidating}>
                Run Validation
              </Button>
            ) : null}
            <Badge color={primaryPresentation?.readyForDealerPortal ? 'green' : 'gray'}>{primaryPresentation?.publishStatus ?? 'draft'}</Badge>
          </Group>
        </Group>
        <Text>{primaryPresentation?.shortDescription ?? 'No dealer-facing description has been approved yet.'}</Text>
        {primaryPresentation && canManageProducts ? (
          <Stack gap="sm" mt="md">
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput label="Display name" value={presentationForm.displayName} onChange={(event) => setPresentationForm((current) => ({ ...current, displayName: event.currentTarget.value }))} />
              <Select label="Review status" data={publishStatusOptions} value={presentationForm.publishStatus} onChange={(value) => setPresentationForm((current) => ({ ...current, publishStatus: (value as ProductPublishStatusKey | null) ?? 'draft' }))} allowDeselect={false} />
              <TextInput label="Region scope" value={presentationForm.regionScope} onChange={(event) => setPresentationForm((current) => ({ ...current, regionScope: event.currentTarget.value }))} />
              <TextInput label="Brand label" value={presentationForm.brandLabel} onChange={(event) => setPresentationForm((current) => ({ ...current, brandLabel: event.currentTarget.value }))} />
            </SimpleGrid>
            <Textarea label="Short description" minRows={2} value={presentationForm.shortDescription} onChange={(event) => setPresentationForm((current) => ({ ...current, shortDescription: event.currentTarget.value }))} />
            <Textarea label="Long description" minRows={3} value={presentationForm.longDescription} onChange={(event) => setPresentationForm((current) => ({ ...current, longDescription: event.currentTarget.value }))} />
            <Textarea label="Spec summary" minRows={2} value={presentationForm.specSummary} onChange={(event) => setPresentationForm((current) => ({ ...current, specSummary: event.currentTarget.value }))} />
            <Group justify="flex-end">
              <Button onClick={handleSavePresentation} loading={isSavingPresentation}>Save Presentation</Button>
            </Group>
          </Stack>
        ) : null}
      </Paper>

      <Paper withBorder p="md">
        <Group justify="space-between" mb="sm" align="flex-end">
          <Stack gap={2}>
            <Title order={4}>Product Files</Title>
            <Text c="dimmed" size="sm">Attach approved images, spec sheets, brochures, and install guides to the dealer-facing product presentation.</Text>
          </Stack>
          {canManageProducts ? (
            <Group align="flex-end">
              <Select
                w={280}
                label="Asset"
                searchable
                clearable
                placeholder="Select asset"
                value={selectedAssetId}
                onChange={setSelectedAssetId}
                data={availableAssets.map((asset) => ({
                  value: asset.id,
                  label: `${asset.title} / ${asset.kind} / ${asset.status} / ${asset.reviewStatus}`,
                }))}
              />
              <Select
                w={190}
                label="Role"
                value={selectedAssetRole}
                onChange={(value) => setSelectedAssetRole((value as ProductAssetRoleKey | null) ?? 'primary_image')}
                data={assetRoleOptions}
                allowDeselect={false}
              />
              <Button
                leftSection={<IconLink size={16} />}
                onClick={handleAssignAsset}
                disabled={!selectedAssetId || !primaryPresentation}
                loading={isAssigningAsset}
              >
                Attach
              </Button>
            </Group>
          ) : null}
        </Group>

        {assetError ? (
          <Alert color="yellow" icon={<IconAlertTriangle size={18} />} mb="sm">
            {assetError}
          </Alert>
        ) : null}

        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Asset</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Kind</Table.Th>
              <Table.Th>Scope</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Required</Table.Th>
              {canManageProducts ? <Table.Th /> : null}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {product.assetAssignments.map((assignment) => (
              <Table.Tr key={assignment.id}>
                <Table.Td>
                  <Text fw={600}>{assignment.title}</Text>
                  <Text size="xs" c="dimmed">/{assignment.stableSlug}</Text>
                </Table.Td>
                <Table.Td>{formatLabel(assignment.role)}</Table.Td>
                <Table.Td>{assignment.kind}</Table.Td>
                <Table.Td>{[assignment.brandScope, assignment.regionScope].filter(Boolean).join(' / ') || 'Unscoped'}</Table.Td>
                <Table.Td><Badge variant="light">{assignment.status} / {assignment.reviewStatus}</Badge></Table.Td>
                <Table.Td>{assignment.isRequired ? 'Yes' : 'No'}</Table.Td>
                {canManageProducts ? (
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      leftSection={<IconUnlink size={14} />}
                      onClick={() => handleUnlinkAsset(assignment.id)}
                      loading={unlinkingAssignmentId === assignment.id}
                    >
                      Unlink
                    </Button>
                  </Table.Td>
                ) : null}
              </Table.Tr>
            ))}
            {!product.assetAssignments.length ? (
              <Table.Tr><Table.Td colSpan={canManageProducts ? 7 : 6}><Text ta="center" c="dimmed" py="md">No files linked to this product yet.</Text></Table.Td></Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </Paper>

      <Paper withBorder p="md">
        <Group mb="sm">
          <IconShieldCheck size={18} />
          <Title order={4}>Dealer Catalog Views</Title>
        </Group>
        <Text c="dimmed" size="sm" mb="sm">
          Catalog views control which dealer context sees this product and its files. They are resolved from account attributes such as affinity, ownership/PE, independent status, region, private label, and portal eligibility. Pricing remains separate.
        </Text>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Catalog view</Table.Th>
              <Table.Th>Resolver value</Table.Th>
              <Table.Th>Region</Table.Th>
              <Table.Th>Brand</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {product.inclusions.map((inclusion) => (
              <Table.Tr key={inclusion.id}>
                <Table.Td>{formatCatalogViewType(inclusion.dealerGroupType)}</Table.Td>
                <Table.Td>{inclusion.dealerGroupId ?? 'Default eligible dealers'}</Table.Td>
                <Table.Td>{inclusion.regionScope ?? 'Any'}</Table.Td>
                <Table.Td>{inclusion.brandLabel ?? 'Neutral'}</Table.Td>
                <Table.Td>{inclusion.isVisible ? inclusion.publishStatus : 'hidden'}</Table.Td>
                <Table.Td>{canManageProducts ? <Button size="xs" variant="light" onClick={() => handleEditInclusion(inclusion)}>Edit</Button> : null}</Table.Td>
              </Table.Tr>
            ))}
            {!product.inclusions.length ? (
              <Table.Tr><Table.Td colSpan={6}><Text ta="center" c="dimmed" py="md">No dealer catalog view rules yet.</Text></Table.Td></Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
        {primaryPresentation && canManageProducts ? (
          <Stack gap="sm" mt="md">
            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <Select label="Catalog view type" data={CATALOG_VIEW_TYPE_OPTIONS} value={inclusionForm.dealerGroupType} onChange={(value) => setInclusionForm((current) => ({ ...current, dealerGroupType: value ?? 'all_dealers' }))} allowDeselect={false} />
              <TextInput label="Resolver value" placeholder="e.g. Service Experts, Nexstar, Redwood, Canada" value={inclusionForm.dealerGroupId} onChange={(event) => setInclusionForm((current) => ({ ...current, dealerGroupId: event.currentTarget.value }))} />
              <Select label="Publish status" data={publishStatusOptions} value={inclusionForm.publishStatus} onChange={(value) => setInclusionForm((current) => ({ ...current, publishStatus: (value as ProductPublishStatusKey | null) ?? 'draft' }))} allowDeselect={false} />
              <TextInput label="Region scope" value={inclusionForm.regionScope} onChange={(event) => setInclusionForm((current) => ({ ...current, regionScope: event.currentTarget.value }))} />
              <TextInput label="Brand label" value={inclusionForm.brandLabel} onChange={(event) => setInclusionForm((current) => ({ ...current, brandLabel: event.currentTarget.value }))} />
              <Checkbox mt="xl" label="Visible" checked={inclusionForm.isVisible} onChange={(event) => setInclusionForm((current) => ({ ...current, isVisible: event.currentTarget.checked }))} />
            </SimpleGrid>
            <Textarea label="Notes" minRows={2} value={inclusionForm.notes} onChange={(event) => setInclusionForm((current) => ({ ...current, notes: event.currentTarget.value }))} />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={handleResetInclusion}>Reset</Button>
              <Button onClick={handleSaveInclusion} loading={isSavingInclusion}>{editingInclusionId ? 'Save Catalog View Rule' : 'Add Catalog View Rule'}</Button>
            </Group>
          </Stack>
        ) : null}
      </Paper>

      <Paper withBorder p="md">
        <Title order={4} mb="sm">Go-Live Checklist</Title>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Check</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Message</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {product.readinessChecks.map((check) => (
              <Table.Tr key={check.id}>
                <Table.Td>{check.checkName}</Table.Td>
                <Table.Td><Badge color={check.status === 'pass' ? 'green' : check.status === 'warning' ? 'yellow' : 'red'}>{check.status}</Badge></Table.Td>
                <Table.Td>{check.message ?? '-'}</Table.Td>
              </Table.Tr>
            ))}
            {!product.readinessChecks.length ? (
              <Table.Tr><Table.Td colSpan={3}><Text ta="center" c="dimmed" py="md">Run publish validation to generate checks.</Text></Table.Td></Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </Paper>
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
