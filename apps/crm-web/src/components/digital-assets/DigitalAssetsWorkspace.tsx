'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  FileInput,
  Group,
  Loader,
  NumberInput,
  Paper,
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
  DIGITAL_ASSET_KINDS,
  DIGITAL_ASSET_REVIEW_STATUSES,
  DIGITAL_ASSET_STATUSES,
  DIGITAL_ASSET_VISIBILITIES,
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

export function DigitalAssetsWorkspace() {
  const { apiBaseUrl, auth } = usePulseSession();
  const [activeTab, setActiveTab] = useState<AssetTab>('library');
  const [search, setSearch] = useState('');
  const [assets, setAssets] = useState<ListDigitalAssetsResponse>({ items: [], total: 0 });
  const [collections, setCollections] = useState<ListDigitalAssetCollectionsResponse>({ items: [], total: 0 });
  const [selectedAsset, setSelectedAsset] = useState<DigitalAssetDetail | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [assetForm, setAssetForm] = useState<CreateAssetFormState>(defaultAssetForm);
  const [collectionForm, setCollectionForm] = useState<CollectionFormState>(defaultCollectionForm);
  const [versionForm, setVersionForm] = useState<VersionFormState>(defaultVersionForm);
  const [assetEditForm, setAssetEditForm] = useState<AssetEditFormState>(defaultAssetEditForm);
  const [shareForm, setShareForm] = useState<ShareFormState>(defaultShareForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isCreatingAsset, setIsCreatingAsset] = useState(false);
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

  const kindOptions = useMemo(() => DIGITAL_ASSET_KINDS.map((kind) => ({ value: kind, label: formatLabel(kind) })), []);
  const statusOptions = useMemo(() => DIGITAL_ASSET_STATUSES.map((status) => ({ value: status, label: formatLabel(status) })), []);
  const visibilityOptions = useMemo(() => DIGITAL_ASSET_VISIBILITIES.map((visibility) => ({ value: visibility, label: formatLabel(visibility) })), []);
  const reviewStatusOptions = useMemo(() => DIGITAL_ASSET_REVIEW_STATUSES.map((status) => ({ value: status, label: formatLabel(status) })), []);
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
      setSelectedAsset(response);
      setAssetEditForm(toAssetEditForm(response));
      setAssetForm(defaultAssetForm);
      await reloadAssets();
    } catch (createError) {
      setDetailError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setIsCreatingAsset(false);
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
        <Title order={2}>Digital Assets</Title>
        <Text c="dimmed">Bounded Widen replacement for product and dealer assets, stable URLs, curated metadata, and S3/CloudFront-ready delivery.</Text>
      </Stack>

      {error ? (
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Digital Assets API not ready">
          {error}
        </Alert>
      ) : null}

      <Tabs value={activeTab} onChange={(value) => setActiveTab((value as AssetTab) ?? 'library')}>
        <Tabs.List>
          <Tabs.Tab value="library" leftSection={<IconPhoto size={16} />}>Asset Library</Tabs.Tab>
          <Tabs.Tab value="collections">Collections</Tabs.Tab>
          <Tabs.Tab value="migration" leftSection={<IconCloudUpload size={16} />}>Migration Manifest</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="library" pt="md">
          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
            <Stack gap="md">
              <Paper withBorder p="md">
                <form onSubmit={handleCreateAsset}>
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={2}>
                        <Title order={4}>Create metadata asset</Title>
                        <Text c="dimmed" size="sm">Create the library record first, then attach an external URL version when the file location is known.</Text>
                      </Stack>
                      <Button leftSection={<IconPlus size={16} />} type="submit" loading={isCreatingAsset} disabled={!assetForm.title.trim()}>
                        Create
                      </Button>
                    </Group>
                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                      <TextInput
                        label="Title"
                        value={assetForm.title}
                        onChange={(event) => setAssetForm((current) => ({ ...current, title: event.currentTarget.value }))}
                        required
                      />
                      <TextInput
                        label="Stable slug"
                        value={assetForm.stableSlug}
                        onChange={(event) => setAssetForm((current) => ({ ...current, stableSlug: event.currentTarget.value }))}
                        placeholder="Auto-generated when blank"
                      />
                      <Select
                        label="Kind"
                        value={assetForm.kind}
                        data={kindOptions}
                        onChange={(value) => setAssetForm((current) => ({ ...current, kind: (value as DigitalAssetKindKey) ?? 'image' }))}
                        allowDeselect={false}
                      />
                      <Select
                        label="Visibility"
                        value={assetForm.visibility}
                        data={visibilityOptions}
                        onChange={(value) => setAssetForm((current) => ({ ...current, visibility: (value as DigitalAssetVisibilityKey) ?? 'internal_only' }))}
                        allowDeselect={false}
                      />
                      <TextInput
                        label="Audience"
                        value={assetForm.audience}
                        onChange={(event) => setAssetForm((current) => ({ ...current, audience: event.currentTarget.value }))}
                      />
                      <TextInput
                        label="Brand scope"
                        value={assetForm.brandScope}
                        onChange={(event) => setAssetForm((current) => ({ ...current, brandScope: event.currentTarget.value }))}
                      />
                      <TextInput
                        label="Region scope"
                        value={assetForm.regionScope}
                        onChange={(event) => setAssetForm((current) => ({ ...current, regionScope: event.currentTarget.value }))}
                      />
                      <TextInput
                        label="Legacy URL"
                        value={assetForm.legacyUrl}
                        onChange={(event) => setAssetForm((current) => ({ ...current, legacyUrl: event.currentTarget.value }))}
                      />
                    </SimpleGrid>
                    <Textarea
                      label="Description"
                      value={assetForm.description}
                      onChange={(event) => setAssetForm((current) => ({ ...current, description: event.currentTarget.value }))}
                      minRows={2}
                    />
                  </Stack>
                </form>
              </Paper>

              <Paper withBorder>
                {isLoading ? (
                  <Group justify="center" p="xl"><Loader /></Group>
                ) : (
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Asset</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Visibility</Table.Th>
                        <Table.Th>Brand / Region</Table.Th>
                        <Table.Th>Source</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {assets.items.map((asset) => (
                        <Table.Tr key={asset.id}>
                          <Table.Td>
                            <Text fw={600}>{asset.title}</Text>
                            <Text size="xs" c="dimmed">/{asset.stableSlug}</Text>
                          </Table.Td>
                          <Table.Td>{asset.kind}</Table.Td>
                          <Table.Td><Badge variant="light">{asset.visibility}</Badge></Table.Td>
                          <Table.Td>{[asset.brandScope, asset.regionScope].filter(Boolean).join(' / ') || 'Unscoped'}</Table.Td>
                          <Table.Td>{asset.sourceSystem}</Table.Td>
                          <Table.Td>
                            <Button size="xs" variant="subtle" onClick={() => loadAssetDetail(asset.id)} loading={isLoadingDetail && selectedAsset?.id === asset.id}>
                              Details
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      {!assets.items.length ? (
                        <Table.Tr><Table.Td colSpan={6}><Text ta="center" c="dimmed" py="lg">No assets loaded yet.</Text></Table.Td></Table.Tr>
                      ) : null}
                    </Table.Tbody>
                  </Table>
                )}
              </Paper>
            </Stack>

            <Stack gap="md">
              <TextInput
                leftSection={<IconSearch size={16} />}
                placeholder="Search title, stable slug, or Widen asset ID"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />

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
                    <Text c="dimmed" size="sm">Select an asset to review metadata and add an external URL version.</Text>
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
                  <Title order={4}>{selectedCollectionId ? 'Edit Collection' : 'Create Collection'}</Title>
                  <Button onClick={handleSaveCollection} loading={isSavingCollection} disabled={!collectionForm.code.trim() || !collectionForm.name.trim()}>
                    {selectedCollectionId ? 'Save' : 'Create'}
                  </Button>
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput label="Code" value={collectionForm.code} onChange={(event) => setCollectionForm((current) => ({ ...current, code: event.currentTarget.value }))} />
                  <TextInput label="Name" value={collectionForm.name} onChange={(event) => setCollectionForm((current) => ({ ...current, name: event.currentTarget.value }))} />
                  <Select label="Visibility" data={visibilityOptions} value={collectionForm.visibility} onChange={(value) => setCollectionForm((current) => ({ ...current, visibility: (value as DigitalAssetVisibilityKey | null) ?? 'internal_only' }))} allowDeselect={false} />
                  <TextInput label="Brand scope" value={collectionForm.brandScope} onChange={(event) => setCollectionForm((current) => ({ ...current, brandScope: event.currentTarget.value }))} />
                  <TextInput label="Region scope" value={collectionForm.regionScope} onChange={(event) => setCollectionForm((current) => ({ ...current, regionScope: event.currentTarget.value }))} />
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
                    <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="lg">No collections configured yet.</Text></Table.Td></Table.Tr>
                  ) : null}
                </Table.Tbody>
              </Table>
            </Paper>
          </SimpleGrid>

          <Paper withBorder p="md" mt="md">
            <Stack gap="sm">
              <Title order={4}>Selected Asset Membership</Title>
              <Text size="sm" c="dimmed">{selectedAsset ? selectedAsset.title : 'Select an asset in the library tab before adding it to a collection.'}</Text>
              <Group align="flex-end">
                <Select
                  label="Collection"
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
                    <Title order={4}>Widen migration reconciliation</Title>
                    <Text c="dimmed">Preview the curated Widen manifest before any asset writes. Legacy URL redirects are intentionally parked and should not be cut over from this panel.</Text>
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

                <Alert color="gray" title="Redirect cutover parked">
                  This preview checks Widen IDs, stable slugs, legacy URLs, and issue counts only. Actual 301 redirects and public legacy URL forwarding remain parked until the delivery cutover plan is approved.
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

async function copyToClipboard(value: string) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(value);
    }
  } catch {
    // Clipboard access can be unavailable in some browser contexts; the link remains visible in the UI.
  }
}
