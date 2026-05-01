'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  FileInput,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconCloudUpload, IconHistory, IconLink, IconPhoto, IconPlus, IconSearch, IconShare } from '@tabler/icons-react';
import {
  type DigitalAssetDetail,
  type DigitalAssetKindKey,
  type DigitalAssetReviewStatusKey,
  type DigitalAssetStatusKey,
  type DigitalAssetVisibilityKey,
} from '@pulse/contracts/digital-assets';
import {
  addDigitalAssetToCollection,
  createDigitalAssetShareLinkRecord,
  createDigitalAssetCollectionRecord,
  createDigitalAssetRecord,
  createDigitalAssetVersionRecord,
  fetchDigitalAssetCollections,
  fetchDigitalAssetDetail,
  fetchDigitalAssetLibrary,
  fetchWidenImportRuns,
  previewWidenImport,
  removeDigitalAssetFromCollection,
  revokeDigitalAssetShareLinkRecord,
  updateDigitalAssetCollectionRecord,
  updateDigitalAssetRecord,
  type DigitalAssetCollectionSummary,
  type ListDigitalAssetCollectionsResponse,
  type ListDigitalAssetsResponse,
  type ListWidenImportRunsResponse,
  type WidenImportPreviewResponse,
} from '@/lib/pulse-api';
import { canPerformAction } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';

type AssetTab = 'library' | 'collections' | 'migration';
type LibraryViewMode = 'cards' | 'list';

type CreateAssetFormState = {
  title: string;
  stableSlug: string;
  description: string;
  kind: DigitalAssetKindKey;
  visibility: DigitalAssetVisibilityKey;
  audience: string;
  brandScope: string;
  regionScope: string;
  legacyUrl: string;
  externalUrl: string;
  fileBase64: string;
  fileName: string;
  mimeType: string;
};

type VersionFormState = {
  externalUrl: string;
  fileBase64: string;
  fileName: string;
  mimeType: string;
  sourceVersionId: string;
  sourceDownloadUrl: string;
  ingestSourceDownload: boolean;
  makeCurrent: boolean;
};

type AssetEditFormState = {
  title: string;
  description: string;
  status: DigitalAssetStatusKey;
  visibility: DigitalAssetVisibilityKey;
  reviewStatus: DigitalAssetReviewStatusKey;
  audience: string;
  brandScope: string;
  regionScope: string;
  dealerGroupType: string;
  dealerGroupId: string;
};

type CollectionFormState = {
  code: string;
  name: string;
  description: string;
  visibility: DigitalAssetVisibilityKey;
  brandScope: string;
  regionScope: string;
  dealerGroupType: string;
  dealerGroupId: string;
  isActive: boolean;
};

type ShareFormState = {
  recipientType: string;
  recipientName: string;
  recipientEmail: string;
  contextType: string;
  contextId: string;
  expiresInDays: number;
  note: string;
};

type BulkUploadFormState = {
  kind: DigitalAssetKindKey;
  visibility: DigitalAssetVisibilityKey;
  audience: string;
  brandScope: string;
  regionScope: string;
};

const defaultAssetForm: CreateAssetFormState = {
  title: '',
  stableSlug: '',
  description: '',
  kind: 'image',
  visibility: 'internal_only',
  audience: 'internal',
  brandScope: '',
  regionScope: '',
  legacyUrl: '',
  externalUrl: '',
  fileBase64: '',
  fileName: '',
  mimeType: '',
};

const defaultVersionForm: VersionFormState = {
  externalUrl: '',
  fileBase64: '',
  fileName: '',
  mimeType: '',
  sourceVersionId: '',
  sourceDownloadUrl: '',
  ingestSourceDownload: false,
  makeCurrent: true,
};

const defaultAssetEditForm: AssetEditFormState = {
  title: '',
  description: '',
  status: 'draft',
  visibility: 'internal_only',
  reviewStatus: 'pending_review',
  audience: 'internal',
  brandScope: '',
  regionScope: '',
  dealerGroupType: '',
  dealerGroupId: '',
};

const defaultCollectionForm: CollectionFormState = {
  code: '',
  name: '',
  description: '',
  visibility: 'internal_only',
  brandScope: '',
  regionScope: '',
  dealerGroupType: '',
  dealerGroupId: '',
  isActive: true,
};

const defaultShareForm: ShareFormState = {
  recipientType: 'prospect',
  recipientName: '',
  recipientEmail: '',
  contextType: '',
  contextId: '',
  expiresInDays: 30,
  note: '',
};

const defaultBulkUploadForm: BulkUploadFormState = {
  kind: 'image',
  visibility: 'internal_only',
  audience: 'internal',
  brandScope: '',
  regionScope: '',
};

const DIGITAL_ASSET_KIND_OPTIONS: DigitalAssetKindKey[] = ['image', 'document', 'video', 'logo', 'presentation', 'other'];
const DIGITAL_ASSET_STATUS_OPTIONS: DigitalAssetStatusKey[] = ['draft', 'active', 'needs_review', 'archived', 'expired'];
const DIGITAL_ASSET_VISIBILITY_OPTIONS: DigitalAssetVisibilityKey[] = ['internal_only', 'dealer_portal', 'public'];
const DIGITAL_ASSET_REVIEW_STATUS_OPTIONS: DigitalAssetReviewStatusKey[] = ['not_required', 'pending_review', 'approved', 'rejected'];

export function DigitalAssetsWorkspace() {
  const { apiBaseUrl, auth } = usePulseSession();
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<AssetTab>('library');
  const [viewMode, setViewMode] = useState<LibraryViewMode>('cards');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<DigitalAssetKindKey | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<DigitalAssetVisibilityKey | null>(null);
  const [assets, setAssets] = useState<ListDigitalAssetsResponse>({ items: [], total: 0 });
  const [collections, setCollections] = useState<ListDigitalAssetCollectionsResponse>({ items: [], total: 0 });
  const [selectedAsset, setSelectedAsset] = useState<DigitalAssetDetail | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [assetForm, setAssetForm] = useState<CreateAssetFormState>(defaultAssetForm);
  const [collectionForm, setCollectionForm] = useState<CollectionFormState>(defaultCollectionForm);
  const [versionForm, setVersionForm] = useState<VersionFormState>(defaultVersionForm);
  const [assetEditForm, setAssetEditForm] = useState<AssetEditFormState>(defaultAssetEditForm);
  const [shareForm, setShareForm] = useState<ShareFormState>(defaultShareForm);
  const [bulkUploadForm, setBulkUploadForm] = useState<BulkUploadFormState>(defaultBulkUploadForm);
  const [bulkUploadFiles, setBulkUploadFiles] = useState<File[]>([]);
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isCreatingAsset, setIsCreatingAsset] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [isUpdatingCollectionItem, setIsUpdatingCollectionItem] = useState(false);
  const [isAddingVersion, setIsAddingVersion] = useState(false);
  const [isUpdatingAsset, setIsUpdatingAsset] = useState(false);
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false);
  const [revokingShareLinkId, setRevokingShareLinkId] = useState<string | null>(null);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<WidenImportPreviewResponse | null>(null);
  const [importRuns, setImportRuns] = useState<ListWidenImportRunsResponse>({ items: [] });

  const kindOptions = useMemo(() => DIGITAL_ASSET_KIND_OPTIONS.map((kind) => ({ value: kind, label: formatLabel(kind) })), []);
  const statusOptions = useMemo(() => DIGITAL_ASSET_STATUS_OPTIONS.map((status) => ({ value: status, label: formatLabel(status) })), []);
  const visibilityOptions = useMemo(() => DIGITAL_ASSET_VISIBILITY_OPTIONS.map((visibility) => ({ value: visibility, label: formatLabel(visibility) })), []);
  const reviewStatusOptions = useMemo(() => DIGITAL_ASSET_REVIEW_STATUS_OPTIONS.map((status) => ({ value: status, label: formatLabel(status) })), []);
  const visibleAssets = useMemo(() => assets.items.filter((asset) => {
    if (kindFilter && asset.kind !== kindFilter) return false;
    if (visibilityFilter && asset.visibility !== visibilityFilter) return false;
    return true;
  }), [assets.items, kindFilter, visibilityFilter]);
  const assetMetrics = useMemo(() => ({
    total: assets.total,
    ready: assets.items.filter((asset) => asset.status === 'active' && asset.reviewStatus === 'approved').length,
    shared: assets.items.filter((asset) => (asset.activeShareLinkCount ?? 0) > 0).length,
    productLinked: assets.items.filter((asset) => (asset.productUsageCount ?? 0) > 0).length,
  }), [assets.items, assets.total]);
  const canEditAssets = auth ? canPerformAction(auth.identity.role, 'digital_asset.edit') : false;
  const canShareAssets = auth ? canPerformAction(auth.identity.role, 'digital_asset.share') : false;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as AssetTab | null;
    if (tab && ['library', 'collections', 'migration'].includes(tab)) {
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
        const [assetResponse, collectionResponse] = await Promise.all([
          fetchDigitalAssetLibrary(apiBaseUrl, auth.tokens.accessToken, { search, limit: 100 }),
          fetchDigitalAssetCollections(apiBaseUrl, auth.tokens.accessToken),
        ]);
        if (!cancelled) {
          setAssets(assetResponse);
          setCollections(collectionResponse);
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

  const reloadAssets = async () => {
    if (!auth) return;
    const [assetResponse, collectionResponse] = await Promise.all([
      fetchDigitalAssetLibrary(apiBaseUrl, auth.tokens.accessToken, { search, limit: 100 }),
      fetchDigitalAssetCollections(apiBaseUrl, auth.tokens.accessToken),
    ]);
    setAssets(assetResponse);
    setCollections(collectionResponse);
  };

  const loadAssetDetail = async (assetId: string) => {
    if (!auth) return;
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const response = await fetchDigitalAssetDetail(apiBaseUrl, auth.tokens.accessToken, assetId);
      setSelectedAsset(response);
      setAssetEditForm(toAssetEditForm(response));
      setShareForm(defaultShareForm);
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleCreateAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth || !assetForm.title.trim()) return;
    setIsCreatingAsset(true);
    setDetailError(null);
    try {
      const response = await createDigitalAssetRecord(apiBaseUrl, auth.tokens.accessToken, {
        title: assetForm.title,
        description: emptyToNull(assetForm.description),
        kind: assetForm.kind,
        visibility: assetForm.visibility,
        audience: assetForm.audience.trim() || 'internal',
        brandScope: emptyToNull(assetForm.brandScope),
        regionScope: emptyToNull(assetForm.regionScope),
        legacyUrl: emptyToNull(assetForm.legacyUrl),
        sourceSystem: 'manual',
        ...(emptyToUndefined(assetForm.stableSlug) ? { stableSlug: emptyToUndefined(assetForm.stableSlug) } : {}),
      });

      const hasInitialFile = assetForm.externalUrl.trim();
      const assetWithVersion = hasInitialFile && assetForm.fileName.trim()
        ? await createDigitalAssetVersionRecord(apiBaseUrl, auth.tokens.accessToken, response.id, {
          externalUrl: assetForm.externalUrl,
          fileName: assetForm.fileName,
          mimeType: emptyToNull(assetForm.mimeType),
          makeCurrent: true,
        })
        : response;

      setSelectedAsset(assetWithVersion);
      setAssetEditForm(toAssetEditForm(assetWithVersion));
      setAssetForm(defaultAssetForm);
      setIsAddLinkOpen(false);
      await reloadAssets();
    } catch (createError) {
      setDetailError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setIsCreatingAsset(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!auth || !bulkUploadFiles.length) return;
    setIsBulkUploading(true);
    setDetailError(null);
    try {
      let lastAsset: DigitalAssetDetail | null = null;
      for (const file of bulkUploadFiles) {
        const created = await createDigitalAssetRecord(apiBaseUrl, auth.tokens.accessToken, {
          title: titleFromFileName(file.name),
          description: null,
          kind: inferAssetKind(file.type, bulkUploadForm.kind),
          visibility: bulkUploadForm.visibility,
          audience: bulkUploadForm.audience.trim() || 'internal',
          brandScope: emptyToNull(bulkUploadForm.brandScope),
          regionScope: emptyToNull(bulkUploadForm.regionScope),
          legacyUrl: null,
          sourceSystem: 'manual',
        });
        lastAsset = await createDigitalAssetVersionRecord(apiBaseUrl, auth.tokens.accessToken, created.id, {
          fileBase64: await readFileAsDataUrl(file),
          fileName: file.name,
          mimeType: file.type || null,
          makeCurrent: true,
        });
      }
      if (lastAsset) {
        setSelectedAsset(lastAsset);
        setAssetEditForm(toAssetEditForm(lastAsset));
      }
      setBulkUploadFiles([]);
      setBulkUploadForm(defaultBulkUploadForm);
      setIsBulkUploadOpen(false);
      await reloadAssets();
    } catch (uploadError) {
      setDetailError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      setIsBulkUploading(false);
    }
  };

  const handleAddVersion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasVersionPayload = versionForm.externalUrl.trim() || versionForm.fileBase64.trim() || (versionForm.ingestSourceDownload && versionForm.sourceDownloadUrl.trim());
    if (!auth || !selectedAsset || !versionForm.fileName.trim() || !hasVersionPayload) return;
    setIsAddingVersion(true);
    setDetailError(null);
    try {
      const response = await createDigitalAssetVersionRecord(apiBaseUrl, auth.tokens.accessToken, selectedAsset.id, {
        externalUrl: versionForm.externalUrl,
        fileBase64: emptyToNull(versionForm.fileBase64),
        fileName: versionForm.fileName,
        mimeType: emptyToNull(versionForm.mimeType),
        sourceVersionId: emptyToNull(versionForm.sourceVersionId),
        sourceDownloadUrl: emptyToNull(versionForm.sourceDownloadUrl),
        ingestSourceDownload: versionForm.ingestSourceDownload,
        makeCurrent: versionForm.makeCurrent,
      });
      setSelectedAsset(response);
      setVersionForm(defaultVersionForm);
      await reloadAssets();
    } catch (versionError) {
      setDetailError(versionError instanceof Error ? versionError.message : String(versionError));
    } finally {
      setIsAddingVersion(false);
    }
  };

  const handleUpdateAsset = async () => {
    if (!auth || !selectedAsset) return;
    setIsUpdatingAsset(true);
    setDetailError(null);
    try {
      await updateDigitalAssetRecord(apiBaseUrl, auth.tokens.accessToken, selectedAsset.id, {
        title: assetEditForm.title,
        description: emptyToNull(assetEditForm.description),
        status: assetEditForm.status,
        visibility: assetEditForm.visibility,
        reviewStatus: assetEditForm.reviewStatus,
        audience: assetEditForm.audience,
        brandScope: emptyToNull(assetEditForm.brandScope),
        regionScope: emptyToNull(assetEditForm.regionScope),
        dealerGroupType: emptyToNull(assetEditForm.dealerGroupType),
        dealerGroupId: emptyToNull(assetEditForm.dealerGroupId),
      });
      await loadAssetDetail(selectedAsset.id);
      await reloadAssets();
    } catch (updateError) {
      setDetailError(updateError instanceof Error ? updateError.message : String(updateError));
    } finally {
      setIsUpdatingAsset(false);
    }
  };

  const handleCreateShareLink = async () => {
    if (!auth || !selectedAsset) return;
    setIsCreatingShareLink(true);
    setDetailError(null);
    try {
      const response = await createDigitalAssetShareLinkRecord(apiBaseUrl, auth.tokens.accessToken, selectedAsset.id, {
        recipientType: shareForm.recipientType,
        recipientName: emptyToNull(shareForm.recipientName),
        recipientEmail: emptyToNull(shareForm.recipientEmail),
        contextType: emptyToNull(shareForm.contextType),
        contextId: emptyToNull(shareForm.contextId),
        expiresInDays: shareForm.expiresInDays,
        note: emptyToNull(shareForm.note),
      });
      await copyToClipboard(response.shareUrl);
      setShareForm(defaultShareForm);
      await loadAssetDetail(selectedAsset.id);
    } catch (shareError) {
      setDetailError(shareError instanceof Error ? shareError.message : String(shareError));
    } finally {
      setIsCreatingShareLink(false);
    }
  };

  const handleRevokeShareLink = async (shareLinkId: string) => {
    if (!auth || !selectedAsset) return;
    setRevokingShareLinkId(shareLinkId);
    setDetailError(null);
    try {
      await revokeDigitalAssetShareLinkRecord(apiBaseUrl, auth.tokens.accessToken, shareLinkId);
      await loadAssetDetail(selectedAsset.id);
    } catch (revokeError) {
      setDetailError(revokeError instanceof Error ? revokeError.message : String(revokeError));
    } finally {
      setRevokingShareLinkId(null);
    }
  };

  const handleEditCollection = (collection: DigitalAssetCollectionSummary) => {
    setSelectedCollectionId(collection.id);
    setCollectionForm({
      code: collection.code,
      name: collection.name,
      description: collection.description ?? '',
      visibility: collection.visibility,
      brandScope: collection.brandScope ?? '',
      regionScope: collection.regionScope ?? '',
      dealerGroupType: collection.dealerGroupType ?? '',
      dealerGroupId: collection.dealerGroupId ?? '',
      isActive: collection.isActive,
    });
    setActiveTab('collections');
  };

  const handleResetCollection = () => {
    setSelectedCollectionId(null);
    setCollectionForm(defaultCollectionForm);
  };

  const handleSaveCollection = async () => {
    if (!auth) return;
    setIsSavingCollection(true);
    setError(null);
    const payload = {
      code: collectionForm.code,
      name: collectionForm.name,
      description: emptyToNull(collectionForm.description),
      visibility: collectionForm.visibility,
      brandScope: emptyToNull(collectionForm.brandScope),
      regionScope: emptyToNull(collectionForm.regionScope),
      dealerGroupType: emptyToNull(collectionForm.dealerGroupType),
      dealerGroupId: emptyToNull(collectionForm.dealerGroupId),
      isActive: collectionForm.isActive,
    };
    try {
      if (selectedCollectionId) {
        await updateDigitalAssetCollectionRecord(apiBaseUrl, auth.tokens.accessToken, selectedCollectionId, payload);
      } else {
        await createDigitalAssetCollectionRecord(apiBaseUrl, auth.tokens.accessToken, payload);
      }
      handleResetCollection();
      await reloadAssets();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSavingCollection(false);
    }
  };

  const handleAddSelectedAssetToCollection = async () => {
    if (!auth || !selectedCollectionId || !selectedAsset) return;
    setIsUpdatingCollectionItem(true);
    setDetailError(null);
    try {
      await addDigitalAssetToCollection(apiBaseUrl, auth.tokens.accessToken, selectedCollectionId, {
        assetId: selectedAsset.id,
      });
      await reloadAssets();
    } catch (membershipError) {
      setDetailError(membershipError instanceof Error ? membershipError.message : String(membershipError));
    } finally {
      setIsUpdatingCollectionItem(false);
    }
  };

  const handleRemoveSelectedAssetFromCollection = async () => {
    if (!auth || !selectedCollectionId || !selectedAsset) return;
    setIsUpdatingCollectionItem(true);
    setDetailError(null);
    try {
      await removeDigitalAssetFromCollection(apiBaseUrl, auth.tokens.accessToken, selectedCollectionId, selectedAsset.id);
      await reloadAssets();
    } catch (membershipError) {
      setDetailError(membershipError instanceof Error ? membershipError.message : String(membershipError));
    } finally {
      setIsUpdatingCollectionItem(false);
    }
  };

  const handlePreviewImport = async () => {
    if (!auth) return;
    setIsPreviewingImport(true);
    setMigrationError(null);
    try {
      const response = await previewWidenImport(apiBaseUrl, auth.tokens.accessToken, { limit: 1000, dryRun: true });
      setImportPreview(response);
    } catch (previewError) {
      setMigrationError(previewError instanceof Error ? previewError.message : String(previewError));
    } finally {
      setIsPreviewingImport(false);
    }
  };

  const handleLoadImportRuns = async () => {
    if (!auth) return;
    setIsLoadingRuns(true);
    setMigrationError(null);
    try {
      const response = await fetchWidenImportRuns(apiBaseUrl, auth.tokens.accessToken, 10);
      setImportRuns(response);
    } catch (runsError) {
      setMigrationError(runsError instanceof Error ? runsError.message : String(runsError));
    } finally {
      setIsLoadingRuns(false);
    }
  };

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2}>Digital Assets</Title>
            <Text c="dimmed">Manage product photos, brochures, spec sheets, videos, and shareable customer links from one library.</Text>
          </Stack>
          <Group>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setIsAddLinkOpen(true)}>
              Add Link
            </Button>
            <Button leftSection={<IconCloudUpload size={16} />} onClick={() => setIsBulkUploadOpen(true)}>
              Bulk Upload
            </Button>
          </Group>
        </Group>
      </Stack>

      {error ? (
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Digital Assets API not ready">
          {error}
        </Alert>
      ) : null}

      <Tabs value={activeTab} onChange={(value) => setActiveTab((value as AssetTab) ?? 'library')}>
        <Tabs.List>
          <Tabs.Tab value="library" leftSection={<IconPhoto size={16} />}>Library</Tabs.Tab>
          <Tabs.Tab value="collections">Asset Sets</Tabs.Tab>
          <Tabs.Tab value="migration" leftSection={<IconCloudUpload size={16} />}>Widen Import</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="library" pt="md">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
            <Metric label="Assets" value={assetMetrics.total} />
            <Metric label="Ready To Use" value={assetMetrics.ready} />
            <Metric label="Shared Links" value={assetMetrics.shared} />
            <Metric label="Linked To Products" value={assetMetrics.productLinked} />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
            <Stack gap="md">
              <Paper withBorder p="md">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={2}>
                      <Title order={4}>Library</Title>
                      <Text c="dimmed" size="sm">Find approved content by name, type, access, usage, or sharing status.</Text>
                    </Stack>
                    <SegmentedControl
                      value={viewMode}
                      onChange={(value) => setViewMode(value as LibraryViewMode)}
                      data={[
                        { label: 'Cards', value: 'cards' },
                        { label: 'List', value: 'list' },
                      ]}
                    />
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <TextInput
                      leftSection={<IconSearch size={16} />}
                      placeholder="Search assets"
                      value={search}
                      onChange={(event) => setSearch(event.currentTarget.value)}
                    />
                    <Select
                      placeholder="All types"
                      data={kindOptions}
                      value={kindFilter}
                      onChange={(value) => setKindFilter(value as DigitalAssetKindKey | null)}
                      clearable
                    />
                    <Select
                      placeholder="All access"
                      data={visibilityOptions}
                      value={visibilityFilter}
                      onChange={(value) => setVisibilityFilter(value as DigitalAssetVisibilityKey | null)}
                      clearable
                    />
                  </SimpleGrid>
                </Stack>
              </Paper>

              <Paper withBorder p={viewMode === 'cards' ? 'md' : 0}>
                {isLoading ? (
                  <Group justify="center" p="xl"><Loader /></Group>
                ) : viewMode === 'cards' ? (
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    {visibleAssets.map((asset) => (
                      <Paper key={asset.id} withBorder p="md">
                        <Stack gap="sm">
                          <Group justify="space-between" align="flex-start">
                            <Stack gap={2}>
                              <Text fw={700}>{asset.title}</Text>
                              <Text size="xs" c="dimmed">{asset.currentVersion?.fileName ?? `/${asset.stableSlug}`}</Text>
                            </Stack>
                            <Badge variant="light">{formatLabel(asset.kind)}</Badge>
                          </Group>
                          <Group gap="xs">
                            <Badge color={asset.visibility === 'public' ? 'green' : asset.visibility === 'dealer_portal' ? 'blue' : 'gray'} variant="light">
                              {formatLabel(asset.visibility)}
                            </Badge>
                            <Badge color={asset.reviewStatus === 'approved' ? 'green' : 'yellow'} variant="light">
                              {formatLabel(asset.reviewStatus)}
                            </Badge>
                          </Group>
                          <SimpleGrid cols={2}>
                            <CountLine label="Products" value={String(asset.productUsageCount ?? 0)} />
                            <CountLine label="Shares" value={String(asset.activeShareLinkCount ?? 0)} />
                          </SimpleGrid>
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">{[asset.brandScope, asset.regionScope].filter(Boolean).join(' / ') || 'Unscoped'}</Text>
                            <Button size="xs" variant="light" onClick={() => loadAssetDetail(asset.id)} loading={isLoadingDetail && selectedAsset?.id === asset.id}>
                              Open
                            </Button>
                          </Group>
                        </Stack>
                      </Paper>
                    ))}
                    {!visibleAssets.length ? (
                      <Paper withBorder p="xl">
                        <Stack gap="xs" align="center">
                          <IconPhoto size={28} />
                          <Text fw={700}>No assets found</Text>
                          <Text size="sm" c="dimmed" ta="center">Upload files in bulk or add a file link to start the library.</Text>
                          <Group>
                            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setIsAddLinkOpen(true)}>Add Link</Button>
                            <Button leftSection={<IconCloudUpload size={16} />} onClick={() => setIsBulkUploadOpen(true)}>Bulk Upload</Button>
                          </Group>
                        </Stack>
                      </Paper>
                    ) : null}
                  </SimpleGrid>
                ) : (
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Asset</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Visibility</Table.Th>
                        <Table.Th>Brand / Region</Table.Th>
                        <Table.Th>Usage</Table.Th>
                        <Table.Th>Shares</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {visibleAssets.map((asset) => (
                        <Table.Tr key={asset.id}>
                          <Table.Td>
                            <Text fw={600}>{asset.title}</Text>
                            <Text size="xs" c="dimmed">{asset.currentVersion?.fileName ?? `/${asset.stableSlug}`}</Text>
                          </Table.Td>
                          <Table.Td>{asset.kind}</Table.Td>
                          <Table.Td><Badge variant="light">{asset.visibility}</Badge></Table.Td>
                          <Table.Td>{[asset.brandScope, asset.regionScope].filter(Boolean).join(' / ') || 'Unscoped'}</Table.Td>
                          <Table.Td>{asset.productUsageCount ?? 0}</Table.Td>
                          <Table.Td>{asset.activeShareLinkCount ?? 0} active / {asset.totalShareLinkAccessCount ?? 0} views</Table.Td>
                          <Table.Td>
                            <Button size="xs" variant="subtle" onClick={() => loadAssetDetail(asset.id)} loading={isLoadingDetail && selectedAsset?.id === asset.id}>
                              Details
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      {!visibleAssets.length ? (
                        <Table.Tr><Table.Td colSpan={7}><Text ta="center" c="dimmed" py="lg">No assets found.</Text></Table.Td></Table.Tr>
                      ) : null}
                    </Table.Tbody>
                  </Table>
                )}
              </Paper>
            </Stack>

            <Stack gap="md">
              <Paper withBorder p="md">
                {detailError ? (
                  <Alert color="yellow" icon={<IconAlertTriangle size={18} />} mb="sm">
                    {detailError}
                  </Alert>
                ) : null}

                {isLoadingDetail && !selectedAsset ? (
                  <Group justify="center" p="xl"><Loader /></Group>
                ) : selectedAsset ? (
                  <AssetDetailPanel
                    asset={selectedAsset}
                    editForm={assetEditForm}
                    form={versionForm}
                    canEdit={canEditAssets}
                    canShare={canShareAssets}
                    isAddingVersion={isAddingVersion}
                    isUpdatingAsset={isUpdatingAsset}
                    isCreatingShareLink={isCreatingShareLink}
                    revokingShareLinkId={revokingShareLinkId}
                    shareForm={shareForm}
                    statusOptions={statusOptions}
                    visibilityOptions={visibilityOptions}
                    reviewStatusOptions={reviewStatusOptions}
                    onEditFormChange={setAssetEditForm}
                    onFormChange={setVersionForm}
                    onShareFormChange={setShareForm}
                    onUpdateAsset={handleUpdateAsset}
                    onCreateShareLink={handleCreateShareLink}
                    onRevokeShareLink={handleRevokeShareLink}
                    onSubmit={handleAddVersion}
                  />
                ) : (
                  <Stack gap="xs">
                    <Title order={4}>Asset detail</Title>
                    <Text c="dimmed" size="sm">Select an asset to review files, product usage, and share links.</Text>
                  </Stack>
                )}
              </Paper>
            </Stack>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="collections" pt="md">
          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
            <Paper withBorder p="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Title order={4}>{selectedCollectionId ? 'Edit Asset Set' : 'Create Asset Set'}</Title>
                  <Button onClick={handleSaveCollection} loading={isSavingCollection} disabled={!collectionForm.code.trim() || !collectionForm.name.trim()}>
                    {selectedCollectionId ? 'Save' : 'Create'}
                  </Button>
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput label="Set code" value={collectionForm.code} onChange={(event) => setCollectionForm((current) => ({ ...current, code: event.currentTarget.value }))} />
                  <TextInput label="Set name" value={collectionForm.name} onChange={(event) => setCollectionForm((current) => ({ ...current, name: event.currentTarget.value }))} />
                  <Select label="Who can access" data={visibilityOptions} value={collectionForm.visibility} onChange={(value) => setCollectionForm((current) => ({ ...current, visibility: (value as DigitalAssetVisibilityKey | null) ?? 'internal_only' }))} allowDeselect={false} />
                  <TextInput label="Brand" value={collectionForm.brandScope} onChange={(event) => setCollectionForm((current) => ({ ...current, brandScope: event.currentTarget.value }))} />
                  <TextInput label="Region" value={collectionForm.regionScope} onChange={(event) => setCollectionForm((current) => ({ ...current, regionScope: event.currentTarget.value }))} />
                  <TextInput label="Dealer group type" value={collectionForm.dealerGroupType} onChange={(event) => setCollectionForm((current) => ({ ...current, dealerGroupType: event.currentTarget.value }))} />
                  <TextInput label="Dealer group ID" value={collectionForm.dealerGroupId} onChange={(event) => setCollectionForm((current) => ({ ...current, dealerGroupId: event.currentTarget.value }))} />
                  <Checkbox mt="xl" label="Active" checked={collectionForm.isActive} onChange={(event) => setCollectionForm((current) => ({ ...current, isActive: event.currentTarget.checked }))} />
                </SimpleGrid>
                <Textarea label="Description" minRows={2} value={collectionForm.description} onChange={(event) => setCollectionForm((current) => ({ ...current, description: event.currentTarget.value }))} />
                <Group justify="flex-end">
                  <Button variant="subtle" onClick={handleResetCollection}>Reset</Button>
                </Group>
              </Stack>
            </Paper>

            <Paper withBorder>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Collection</Table.Th>
                    <Table.Th>Visibility</Table.Th>
                    <Table.Th>Items</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {collections.items.map((collection) => (
                    <Table.Tr key={collection.id}>
                      <Table.Td>
                        <Text fw={600}>{collection.name}</Text>
                        <Text size="xs" c="dimmed">{collection.code}</Text>
                      </Table.Td>
                      <Table.Td>{collection.visibility}</Table.Td>
                      <Table.Td>{collection.itemCount ?? 0}</Table.Td>
                      <Table.Td><Badge color={collection.isActive ? 'green' : 'gray'} variant="light">{collection.isActive ? 'Active' : 'Inactive'}</Badge></Table.Td>
                      <Table.Td><Button size="xs" variant="light" onClick={() => handleEditCollection(collection)}>Edit</Button></Table.Td>
                    </Table.Tr>
                  ))}
                  {!collections.items.length ? (
                    <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="lg">No asset sets configured yet.</Text></Table.Td></Table.Tr>
                  ) : null}
                </Table.Tbody>
              </Table>
            </Paper>
          </SimpleGrid>

          <Paper withBorder p="md" mt="md">
            <Stack gap="sm">
              <Title order={4}>Add Selected Asset To Set</Title>
              <Text size="sm" c="dimmed">{selectedAsset ? selectedAsset.title : 'Select an asset in the library tab before adding it to a collection.'}</Text>
              <Group align="flex-end">
                <Select
                  label="Asset set"
                  data={collections.items.map((collection) => ({ value: collection.id, label: collection.name }))}
                  value={selectedCollectionId}
                  onChange={setSelectedCollectionId}
                  searchable
                  clearable
                  w={320}
                />
                <Button onClick={handleAddSelectedAssetToCollection} loading={isUpdatingCollectionItem} disabled={!selectedAsset || !selectedCollectionId}>
                  Add Asset
                </Button>
                <Button variant="light" color="red" onClick={handleRemoveSelectedAssetFromCollection} loading={isUpdatingCollectionItem} disabled={!selectedAsset || !selectedCollectionId}>
                  Remove Asset
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="migration" pt="md">
          <Stack gap="md">
            <Paper withBorder p="md">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Title order={4}>Widen Import Review</Title>
                    <Text c="dimmed">Preview Widen files before they are added to the Pulse asset library.</Text>
                  </Stack>
                  <Group>
                    <Button leftSection={<IconHistory size={16} />} variant="subtle" onClick={handleLoadImportRuns} loading={isLoadingRuns}>
                      Load Runs
                    </Button>
                    <Button leftSection={<IconCloudUpload size={16} />} onClick={handlePreviewImport} loading={isPreviewingImport}>
                      Preview Import
                    </Button>
                  </Group>
                </Group>

                <Alert color="gray" title="Import only, no redirect cutover yet">
                  This checks Widen IDs, asset names, original URLs, and issue counts. Public Widen redirect cutover stays parked until the migration plan is approved.
                </Alert>

                {migrationError ? (
                  <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Widen import API not ready">
                    {migrationError}
                  </Alert>
                ) : null}

                {importPreview ? <WidenPreviewSummary preview={importPreview} /> : (
                  <Text c="dimmed" size="sm">Run a dry preview to see import counts, reconciliation issues, and a sample of proposed Pulse asset URLs.</Text>
                )}
              </Stack>
            </Paper>

            {importRuns.items.length ? (
              <Paper withBorder>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Run</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Records</Table.Th>
                      <Table.Th>Created / Updated</Table.Th>
                      <Table.Th>Skipped / Errors</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {importRuns.items.map((run) => (
                      <Table.Tr key={run.id}>
                        <Table.Td>
                          <Text fw={600}>{run.batchCode ?? run.id}</Text>
                          <Text size="xs" c="dimmed">{run.sourceExportName ?? formatDate(run.createdAt)}</Text>
                        </Table.Td>
                        <Table.Td><Badge variant="light">{run.status}</Badge></Table.Td>
                        <Table.Td>{run.sourceRecordCount}</Table.Td>
                        <Table.Td>{run.createdAssetCount} / {run.updatedAssetCount}</Table.Td>
                        <Table.Td>{run.skippedRecordCount} / {run.errorCount}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            ) : null}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Modal opened={isAddLinkOpen} onClose={() => setIsAddLinkOpen(false)} title="Add Asset Link" size="lg" centered>
        <form onSubmit={handleCreateAsset}>
          <Stack gap="sm">
            <Text c="dimmed" size="sm">Paste a file link for one asset. Use Bulk Upload when you have files from your computer.</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Asset name"
                value={assetForm.title}
                onChange={(event) => setAssetForm((current) => ({ ...current, title: event.currentTarget.value }))}
                required
              />
              <Select
                label="Type"
                value={assetForm.kind}
                data={kindOptions}
                onChange={(value) => setAssetForm((current) => ({ ...current, kind: (value as DigitalAssetKindKey) ?? 'image' }))}
                allowDeselect={false}
              />
              <Select
                label="Who can access"
                value={assetForm.visibility}
                data={visibilityOptions}
                onChange={(value) => setAssetForm((current) => ({ ...current, visibility: (value as DigitalAssetVisibilityKey) ?? 'internal_only' }))}
                allowDeselect={false}
              />
              <TextInput
                label="Paste file link"
                value={assetForm.externalUrl}
                onChange={(event) => setAssetForm((current) => ({ ...current, externalUrl: event.currentTarget.value }))}
                placeholder="https://..."
              />
              <TextInput
                label="File name"
                value={assetForm.fileName}
                onChange={(event) => setAssetForm((current) => ({ ...current, fileName: event.currentTarget.value }))}
                placeholder="Required when link is provided"
              />
              <TextInput
                label="Use for"
                value={assetForm.audience}
                onChange={(event) => setAssetForm((current) => ({ ...current, audience: event.currentTarget.value }))}
              />
            </SimpleGrid>
            <Textarea
              label="Notes"
              value={assetForm.description}
              onChange={(event) => setAssetForm((current) => ({ ...current, description: event.currentTarget.value }))}
              minRows={2}
            />
            <details>
              <summary>Advanced details</summary>
              <SimpleGrid cols={{ base: 1, sm: 2 }} mt="sm">
                <TextInput
                  label="Custom URL slug"
                  value={assetForm.stableSlug}
                  onChange={(event) => setAssetForm((current) => ({ ...current, stableSlug: event.currentTarget.value }))}
                  placeholder="Auto-generated when blank"
                />
                <TextInput
                  label="MIME type"
                  value={assetForm.mimeType}
                  onChange={(event) => setAssetForm((current) => ({ ...current, mimeType: event.currentTarget.value }))}
                />
                <TextInput
                  label="Brand"
                  value={assetForm.brandScope}
                  onChange={(event) => setAssetForm((current) => ({ ...current, brandScope: event.currentTarget.value }))}
                />
                <TextInput
                  label="Region"
                  value={assetForm.regionScope}
                  onChange={(event) => setAssetForm((current) => ({ ...current, regionScope: event.currentTarget.value }))}
                />
                <TextInput
                  label="Original Widen URL"
                  value={assetForm.legacyUrl}
                  onChange={(event) => setAssetForm((current) => ({ ...current, legacyUrl: event.currentTarget.value }))}
                />
              </SimpleGrid>
            </details>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setIsAddLinkOpen(false)}>Cancel</Button>
              <Button leftSection={<IconPlus size={16} />} type="submit" loading={isCreatingAsset} disabled={!assetForm.title.trim() || Boolean(assetForm.externalUrl.trim() && !assetForm.fileName.trim())}>
                Add Link
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={isBulkUploadOpen} onClose={() => setIsBulkUploadOpen(false)} title="Bulk Upload Assets" size="xl" centered>
        <Stack gap="md">
          <Paper withBorder p="lg">
            <Stack gap="sm" align="center">
              <IconCloudUpload size={32} />
              <Stack gap={2} align="center">
                <Title order={4}>Choose multiple files</Title>
                <Text size="sm" c="dimmed" ta="center">Upload product photos, brochures, spec sheets, presentations, or videos in one batch.</Text>
              </Stack>
              <input
                ref={bulkFileInputRef}
                type="file"
                multiple
                hidden
                onChange={(event) => setBulkUploadFiles(Array.from(event.currentTarget.files ?? []))}
              />
              <Group>
                <Button variant="light" onClick={() => bulkFileInputRef.current?.click()}>
                  Choose Files
                </Button>
                {bulkUploadFiles.length ? (
                  <Button variant="subtle" color="red" onClick={() => setBulkUploadFiles([])}>
                    Clear
                  </Button>
                ) : null}
              </Group>
              <Text size="sm" c="dimmed">{bulkUploadFiles.length ? `${bulkUploadFiles.length} file${bulkUploadFiles.length === 1 ? '' : 's'} selected` : 'No files selected yet'}</Text>
            </Stack>
          </Paper>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Default type"
              value={bulkUploadForm.kind}
              data={kindOptions}
              onChange={(value) => setBulkUploadForm((current) => ({ ...current, kind: (value as DigitalAssetKindKey | null) ?? 'image' }))}
              allowDeselect={false}
            />
            <Select
              label="Who can access"
              value={bulkUploadForm.visibility}
              data={visibilityOptions}
              onChange={(value) => setBulkUploadForm((current) => ({ ...current, visibility: (value as DigitalAssetVisibilityKey | null) ?? 'internal_only' }))}
              allowDeselect={false}
            />
            <TextInput
              label="Use for"
              value={bulkUploadForm.audience}
              onChange={(event) => setBulkUploadForm((current) => ({ ...current, audience: event.currentTarget.value }))}
            />
            <TextInput
              label="Brand"
              value={bulkUploadForm.brandScope}
              onChange={(event) => setBulkUploadForm((current) => ({ ...current, brandScope: event.currentTarget.value }))}
            />
            <TextInput
              label="Region"
              value={bulkUploadForm.regionScope}
              onChange={(event) => setBulkUploadForm((current) => ({ ...current, regionScope: event.currentTarget.value }))}
            />
          </SimpleGrid>

          {bulkUploadFiles.length ? (
            <Paper withBorder>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>File</Table.Th>
                    <Table.Th>Detected type</Table.Th>
                    <Table.Th>Size</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {bulkUploadFiles.map((file) => (
                    <Table.Tr key={`${file.name}-${file.size}-${file.lastModified}`}>
                      <Table.Td>{file.name}</Table.Td>
                      <Table.Td>{formatLabel(inferAssetKind(file.type, bulkUploadForm.kind))}</Table.Td>
                      <Table.Td>{formatBytes(file.size)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          ) : null}

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setIsBulkUploadOpen(false)}>Cancel</Button>
            <Button leftSection={<IconCloudUpload size={16} />} onClick={handleBulkUpload} loading={isBulkUploading} disabled={!bulkUploadFiles.length}>
              Upload {bulkUploadFiles.length || ''} Asset{bulkUploadFiles.length === 1 ? '' : 's'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function AssetDetailPanel({
  asset,
  editForm,
  form,
  canEdit,
  canShare,
  isAddingVersion,
  isUpdatingAsset,
  isCreatingShareLink,
  revokingShareLinkId,
  shareForm,
  statusOptions,
  visibilityOptions,
  reviewStatusOptions,
  onEditFormChange,
  onFormChange,
  onShareFormChange,
  onUpdateAsset,
  onCreateShareLink,
  onRevokeShareLink,
  onSubmit,
}: {
  asset: DigitalAssetDetail;
  editForm: AssetEditFormState;
  form: VersionFormState;
  shareForm: ShareFormState;
  canEdit: boolean;
  canShare: boolean;
  isAddingVersion: boolean;
  isUpdatingAsset: boolean;
  isCreatingShareLink: boolean;
  revokingShareLinkId: string | null;
  statusOptions: Array<{ value: string; label: string }>;
  visibilityOptions: Array<{ value: string; label: string }>;
  reviewStatusOptions: Array<{ value: string; label: string }>;
  onEditFormChange: (form: AssetEditFormState) => void;
  onFormChange: (form: VersionFormState) => void;
  onShareFormChange: (form: ShareFormState) => void;
  onUpdateAsset: () => void;
  onCreateShareLink: () => void;
  onRevokeShareLink: (shareLinkId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const currentUrl = asset.currentVersion?.publicUrl ?? asset.currentVersion?.externalUrl;
  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Title order={4}>{asset.title}</Title>
          <Text c="dimmed" size="sm">/{asset.stableSlug}</Text>
        </Stack>
        <Badge variant="light">{asset.status} / {asset.reviewStatus}</Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <CountLine label="Kind" value={asset.kind} />
        <CountLine label="Visibility" value={asset.visibility} />
        <CountLine label="Audience" value={asset.audience} />
        <CountLine label="Scope" value={[asset.brandScope, asset.regionScope].filter(Boolean).join(' / ') || 'Unscoped'} />
        <CountLine label="Product usage" value={String(asset.productUsageCount ?? 0)} />
        <CountLine label="Active shares" value={`${asset.activeShareLinkCount ?? 0} links / ${asset.totalShareLinkAccessCount ?? 0} views`} />
      </SimpleGrid>

      {asset.description ? <Text size="sm">{asset.description}</Text> : null}
      {currentUrl ? (
        <Group gap="xs">
          <Button
            component="a"
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            size="xs"
            variant="light"
            leftSection={<IconLink size={14} />}
          >
            Open Current Link
          </Button>
          <Button size="xs" variant="subtle" onClick={() => copyToClipboard(currentUrl)}>
            Copy Current Link
          </Button>
        </Group>
      ) : null}
      {asset.legacyUrl ? (
        <Text component="a" href={asset.legacyUrl} target="_blank" rel="noreferrer" size="sm" c="blue">
          {asset.legacyUrl}
        </Text>
      ) : null}

      {canShare ? (
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Group justify="space-between">
              <Title order={5}>Share With Prospect Or Customer</Title>
              <Button
                leftSection={<IconShare size={16} />}
                onClick={onCreateShareLink}
                loading={isCreatingShareLink}
                disabled={!asset.currentVersion}
              >
                Create Link
              </Button>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="Recipient type"
                data={[
                  { value: 'prospect', label: 'Prospect' },
                  { value: 'customer', label: 'Customer' },
                  { value: 'dealer', label: 'Dealer' },
                  { value: 'internal', label: 'Internal' },
                ]}
                value={shareForm.recipientType}
                onChange={(value) => onShareFormChange({ ...shareForm, recipientType: value ?? 'prospect' })}
                allowDeselect={false}
              />
              <NumberInput
                label="Expires in days"
                min={1}
                max={365}
                value={shareForm.expiresInDays}
                onChange={(value) => onShareFormChange({ ...shareForm, expiresInDays: typeof value === 'number' ? value : 30 })}
              />
              <TextInput label="Recipient name" value={shareForm.recipientName} onChange={(event) => onShareFormChange({ ...shareForm, recipientName: event.currentTarget.value })} />
              <TextInput label="Recipient email" value={shareForm.recipientEmail} onChange={(event) => onShareFormChange({ ...shareForm, recipientEmail: event.currentTarget.value })} />
              <TextInput label="Context type" value={shareForm.contextType} onChange={(event) => onShareFormChange({ ...shareForm, contextType: event.currentTarget.value })} />
              <TextInput label="Context ID" value={shareForm.contextId} onChange={(event) => onShareFormChange({ ...shareForm, contextId: event.currentTarget.value })} />
            </SimpleGrid>
            <Textarea label="Note" minRows={2} value={shareForm.note} onChange={(event) => onShareFormChange({ ...shareForm, note: event.currentTarget.value })} />

            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Recipient</Table.Th>
                  <Table.Th>Expires</Table.Th>
                  <Table.Th>Access</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(asset.shareLinks ?? []).map((shareLink) => (
                  <Table.Tr key={shareLink.id}>
                    <Table.Td>
                      <Text size="sm" fw={600}>{shareLink.recipientName || shareLink.recipientEmail || formatLabel(shareLink.recipientType)}</Text>
                      <Text size="xs" c="dimmed">{shareLink.shareUrl}</Text>
                    </Table.Td>
                    <Table.Td>{shareLink.expiresAt ? formatDate(shareLink.expiresAt) : 'No expiry'}</Table.Td>
                    <Table.Td>{shareLink.accessCount}</Table.Td>
                    <Table.Td><Badge color={shareLink.revokedAt ? 'gray' : 'green'} variant="light">{shareLink.revokedAt ? 'Revoked' : 'Active'}</Badge></Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end">
                        <Button size="xs" variant="subtle" onClick={() => copyToClipboard(shareLink.shareUrl)}>Copy</Button>
                        {!shareLink.revokedAt ? (
                          <Button size="xs" color="red" variant="subtle" loading={revokingShareLinkId === shareLink.id} onClick={() => onRevokeShareLink(shareLink.id)}>
                            Revoke
                          </Button>
                        ) : null}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {!(asset.shareLinks ?? []).length ? (
                  <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="md">No share links created yet.</Text></Table.Td></Table.Tr>
                ) : null}
              </Table.Tbody>
            </Table>
          </Stack>
        </Paper>
      ) : null}

      <Paper withBorder p="md">
        <Stack gap="sm">
          <Title order={5}>Product Usage</Title>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Product</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Scope</Table.Th>
                <Table.Th>Required</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(asset.productUsages ?? []).map((usage) => (
                <Table.Tr key={usage.id}>
                  <Table.Td>
                    <Text size="sm" fw={600}>{usage.presentationName}</Text>
                    <Text size="xs" c="dimmed">{usage.productSku} / {usage.productName}</Text>
                  </Table.Td>
                  <Table.Td>{formatLabel(usage.role)}</Table.Td>
                  <Table.Td>{[usage.brandLabel, usage.regionScope, usage.dealerGroupId].filter(Boolean).join(' / ') || 'Unscoped'}</Table.Td>
                  <Table.Td>{usage.isRequired ? 'Yes' : 'No'}</Table.Td>
                </Table.Tr>
              ))}
              {!(asset.productUsages ?? []).length ? (
                <Table.Tr><Table.Td colSpan={4}><Text ta="center" c="dimmed" py="md">This asset is not linked to any product presentation yet.</Text></Table.Td></Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </Stack>
      </Paper>

      {canEdit ? (
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Group justify="space-between">
              <Title order={5}>Governance</Title>
              <Button onClick={onUpdateAsset} loading={isUpdatingAsset} disabled={!editForm.title.trim()}>
                Save Asset
              </Button>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Title" value={editForm.title} onChange={(event) => onEditFormChange({ ...editForm, title: event.currentTarget.value })} />
              <TextInput label="Audience" value={editForm.audience} onChange={(event) => onEditFormChange({ ...editForm, audience: event.currentTarget.value })} />
              <Select label="Status" data={statusOptions} value={editForm.status} onChange={(value) => onEditFormChange({ ...editForm, status: (value as DigitalAssetStatusKey | null) ?? 'draft' })} allowDeselect={false} />
              <Select label="Visibility" data={visibilityOptions} value={editForm.visibility} onChange={(value) => onEditFormChange({ ...editForm, visibility: (value as DigitalAssetVisibilityKey | null) ?? 'internal_only' })} allowDeselect={false} />
              <Select label="Review" data={reviewStatusOptions} value={editForm.reviewStatus} onChange={(value) => onEditFormChange({ ...editForm, reviewStatus: (value as DigitalAssetReviewStatusKey | null) ?? 'pending_review' })} allowDeselect={false} />
              <TextInput label="Brand scope" value={editForm.brandScope} onChange={(event) => onEditFormChange({ ...editForm, brandScope: event.currentTarget.value })} />
              <TextInput label="Region scope" value={editForm.regionScope} onChange={(event) => onEditFormChange({ ...editForm, regionScope: event.currentTarget.value })} />
              <TextInput label="Dealer group type" value={editForm.dealerGroupType} onChange={(event) => onEditFormChange({ ...editForm, dealerGroupType: event.currentTarget.value })} />
              <TextInput label="Dealer group ID" value={editForm.dealerGroupId} onChange={(event) => onEditFormChange({ ...editForm, dealerGroupId: event.currentTarget.value })} />
            </SimpleGrid>
            <Textarea label="Description" minRows={2} value={editForm.description} onChange={(event) => onEditFormChange({ ...editForm, description: event.currentTarget.value })} />
          </Stack>
        </Paper>
      ) : null}

      {(asset.legacyMetadataFields?.length || asset.migrationIssues?.length || asset.legacyMetadata) ? (
        <Paper withBorder p="md">
          <Stack gap="md">
            <Title order={5}>Migration Trace</Title>
            {asset.legacyMetadataFields?.length ? (
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Field</Table.Th>
                    <Table.Th>Value</Table.Th>
                    <Table.Th>Type</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {asset.legacyMetadataFields.slice(0, 12).map((field) => (
                    <Table.Tr key={field.id}>
                      <Table.Td>{field.fieldLabel ?? field.fieldKey}</Table.Td>
                      <Table.Td>{field.fieldValue ?? JSON.stringify(field.fieldValueJson ?? '')}</Table.Td>
                      <Table.Td>{field.valueType ?? 'text'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : asset.legacyMetadata ? (
              <Text size="sm" c="dimmed">{Object.keys(asset.legacyMetadata).slice(0, 12).join(', ')}</Text>
            ) : null}
            {asset.migrationIssues?.length ? (
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Severity</Table.Th>
                    <Table.Th>Issue</Table.Th>
                    <Table.Th>Message</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {asset.migrationIssues.slice(0, 10).map((issue) => (
                    <Table.Tr key={issue.id}>
                      <Table.Td><Badge color={issue.severity === 'error' ? 'red' : 'yellow'} variant="light">{issue.severity}</Badge></Table.Td>
                      <Table.Td>{issue.issueCode}</Table.Td>
                      <Table.Td>{issue.message}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : null}
          </Stack>
        </Paper>
      ) : null}

      <form onSubmit={onSubmit}>
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={5}>Add external URL version</Title>
            <Button leftSection={<IconLink size={16} />} type="submit" loading={isAddingVersion} disabled={!form.fileName.trim() || (!form.externalUrl.trim() && !form.fileBase64.trim() && !(form.ingestSourceDownload && form.sourceDownloadUrl.trim()))}>
              Add Version
            </Button>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <FileInput
              label="Upload file"
              clearable
              onChange={(file) => {
                if (!file) {
                  onFormChange({ ...form, fileBase64: '' });
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => onFormChange({
                  ...form,
                  fileBase64: String(reader.result ?? ''),
                  fileName: form.fileName || file.name,
                  mimeType: form.mimeType || file.type,
                });
                reader.readAsDataURL(file);
              }}
            />
            <TextInput
              label="External URL"
              value={form.externalUrl}
              onChange={(event) => onFormChange({ ...form, externalUrl: event.currentTarget.value })}
            />
            <TextInput
              label="File name"
              value={form.fileName}
              onChange={(event) => onFormChange({ ...form, fileName: event.currentTarget.value })}
              required
            />
            <TextInput
              label="MIME type"
              value={form.mimeType}
              onChange={(event) => onFormChange({ ...form, mimeType: event.currentTarget.value })}
              placeholder="image/png"
            />
            <TextInput
              label="Source version ID"
              value={form.sourceVersionId}
              onChange={(event) => onFormChange({ ...form, sourceVersionId: event.currentTarget.value })}
            />
            <TextInput
              label="Source download URL"
              value={form.sourceDownloadUrl}
              onChange={(event) => onFormChange({ ...form, sourceDownloadUrl: event.currentTarget.value })}
            />
            <Checkbox
              mt="xl"
              label="Copy source URL into managed storage"
              checked={form.ingestSourceDownload}
              onChange={(event) => onFormChange({ ...form, ingestSourceDownload: event.currentTarget.checked })}
            />
            <Checkbox
              mt="xl"
              label="Make current version"
              checked={form.makeCurrent}
              onChange={(event) => onFormChange({ ...form, makeCurrent: event.currentTarget.checked })}
            />
          </SimpleGrid>
        </Stack>
      </form>

      <Paper withBorder>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Version</Table.Th>
              <Table.Th>File</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th>Created</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {asset.versions.map((version) => (
              <Table.Tr key={version.id}>
                <Table.Td>
                  <Badge color={version.isCurrent ? 'green' : 'gray'}>v{version.versionNumber}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text fw={600} size="sm">{version.fileName}</Text>
                  <Text c="dimmed" size="xs">{version.mimeType ?? 'Unknown type'}</Text>
                </Table.Td>
                <Table.Td>
                  {version.publicUrl || version.externalUrl ? (
                    <Text component="a" href={version.publicUrl ?? version.externalUrl} target="_blank" rel="noreferrer" size="xs" c="blue">
                      {version.publicUrl ?? version.externalUrl}
                    </Text>
                  ) : (
                    <Text size="xs" c="dimmed">{version.storageKey ?? 'No location'}</Text>
                  )}
                </Table.Td>
                <Table.Td>{formatDate(version.createdAt)}</Table.Td>
              </Table.Tr>
            ))}
            {!asset.versions.length ? (
              <Table.Tr><Table.Td colSpan={4}><Text ta="center" c="dimmed" py="md">No versions attached yet.</Text></Table.Td></Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}

function WidenPreviewSummary({ preview }: { preview: WidenImportPreviewResponse }) {
  const totalRecords = preview.sourceRecordCount ?? preview.totalRecords ?? 0;
  const candidateAssets = preview.candidateAssetCount ?? preview.validRowCount ?? (preview.createdAssetCount ?? 0) + (preview.updatedAssetCount ?? 0);
  const redirectsPlanned = preview.redirectPlanCount ?? preview.redirectCount ?? 0;
  const rowIssues = preview.sampleRows?.flatMap((row) => row.issues) ?? [];
  const issues = preview.issues ?? summarizeRowIssues(rowIssues);
  const warnings = preview.warnings ?? [];

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <Metric label="Source Records" value={totalRecords} />
        <Metric label="Candidate Assets" value={candidateAssets} />
        <Metric label="Skipped Records" value={preview.skippedRecordCount ?? 0} />
        <Metric label="Redirects Parked" value={redirectsPlanned} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Paper withBorder p="md">
          <Title order={5}>Issue summary</Title>
          {issues.length || warnings.length ? (
            <Stack gap="xs" mt="sm">
              {issues.map((issue) => (
                <Group key={`${issue.severity}-${issue.issueCode}-${issue.message}`} justify="space-between" wrap="nowrap">
                  <Stack gap={0}>
                    <Text fw={600} size="sm">{issue.issueCode}</Text>
                    <Text c="dimmed" size="xs">{issue.message}</Text>
                  </Stack>
                  <Badge color={issue.severity === 'error' ? 'red' : 'yellow'}>{issue.count ?? issue.severity}</Badge>
                </Group>
              ))}
              {warnings.map((warning) => (
                <Text key={warning} size="sm" c="dimmed">{warning}</Text>
              ))}
            </Stack>
          ) : (
            <Text c="dimmed" size="sm" mt="sm">No blocking issues returned by the preview.</Text>
          )}
        </Paper>

        <Paper withBorder p="md">
          <Title order={5}>Reconciliation counts</Title>
          <Stack gap={6} mt="sm">
            <CountLine label="Creates" value={String(preview.createdAssetCount ?? 0)} />
            <CountLine label="Updates" value={String(preview.updatedAssetCount ?? 0)} />
            <CountLine label="Warnings" value={String(preview.warningCount ?? warnings.length)} />
            <CountLine label="Errors" value={String(preview.errorCount ?? issues.filter((issue) => issue.severity === 'error').length)} />
            <CountLine label="Duplicate Widen IDs" value={String(preview.duplicateExternalAssetCount ?? preview.duplicateCount ?? 0)} />
            <CountLine label="Missing legacy URLs" value={String(preview.missingLegacyUrlCount ?? 0)} />
          </Stack>
        </Paper>
      </SimpleGrid>

      {preview.sampleAssets?.length || preview.sampleRows?.length ? (
        <Paper withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Widen ID</Table.Th>
                <Table.Th>Asset</Table.Th>
                <Table.Th>Stable Slug</Table.Th>
                <Table.Th>Legacy URL</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {preview.sampleAssets?.map((asset) => (
                <Table.Tr key={`${asset.widenAssetId ?? asset.stableSlug}-${asset.legacyUrl ?? asset.title}`}>
                  <Table.Td>{asset.widenAssetId ?? 'Unmapped'}</Table.Td>
                  <Table.Td>{asset.title ?? 'Untitled asset'}</Table.Td>
                  <Table.Td>{asset.stableSlug ?? asset.proposedStableUrl ?? 'Pending'}</Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{asset.legacyUrl ?? 'No legacy URL'}</Text></Table.Td>
                </Table.Tr>
              ))}
              {preview.sampleRows?.map((asset) => (
                <Table.Tr key={`${asset.rowNumber}-${asset.externalAssetId ?? asset.title}`}>
                  <Table.Td>{asset.externalAssetId ?? 'Unmapped'}</Table.Td>
                  <Table.Td>
                    <Text>{asset.title ?? 'Untitled asset'}</Text>
                    <Text size="xs" c="dimmed">{asset.fileName ?? asset.kind}</Text>
                  </Table.Td>
                  <Table.Td>{asset.status}</Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{asset.legacyUrl ?? 'No legacy URL'}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      ) : null}
    </Stack>
  );
}

function summarizeRowIssues(issues: Array<{ severity: string; issueCode: string; message: string }>) {
  const grouped = new Map<string, { severity: string; issueCode: string; message: string; count: number }>();
  for (const issue of issues) {
    const key = `${issue.severity}-${issue.issueCode}-${issue.message}`;
    const existing = grouped.get(key);
    if (existing) existing.count += 1;
    else grouped.set(key, { ...issue, count: 1 });
  }
  return Array.from(grouped.values());
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Paper withBorder p="md">
      <Text size="xs" tt="uppercase" fw={700} c="dimmed">{label}</Text>
      <Text size="xl" fw={700}>{value}</Text>
    </Paper>
  );
}

function CountLine({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between">
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="sm" fw={700}>{value}</Text>
    </Group>
  );
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function emptyToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toAssetEditForm(asset: DigitalAssetDetail): AssetEditFormState {
  return {
    title: asset.title,
    description: asset.description ?? '',
    status: asset.status,
    visibility: asset.visibility,
    reviewStatus: asset.reviewStatus,
    audience: asset.audience,
    brandScope: asset.brandScope ?? '',
    regionScope: asset.regionScope ?? '',
    dealerGroupType: asset.dealerGroupType ?? '',
    dealerGroupId: asset.dealerGroupId ?? '',
  };
}

function formatLabel(value: string) {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || fileName;
}

function inferAssetKind(mimeType: string, fallback: DigitalAssetKindKey): DigitalAssetKindKey {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word')) return 'document';
  return fallback;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

async function copyToClipboard(value: string) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(value);
    }
  } catch {
    // Clipboard access can be unavailable in some browser contexts; the link remains visible in the UI.
  }
}
