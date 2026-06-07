'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  FileButton,
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
import { IconAlertTriangle, IconCloudUpload, IconFilter, IconHistory, IconLink, IconPhoto, IconPlus, IconSearch, IconShare } from '@tabler/icons-react';
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
import {
  EmptyStateMessage,
  WorkbenchAdvancedSection,
  WorkbenchDetailRail,
  WorkbenchHeader,
  WorkbenchMoreMenu,
  WorkbenchTable,
  type WorkbenchMenuItem,
} from '@/components/ui/Workbench';

type AssetTab = 'library' | 'collections' | 'migration' | 'delivery-health';
type LibraryViewMode = 'cards' | 'list';
type BulkUploadStep = 'select' | 'review' | 'defaults';
type DigitalAssetLibraryRow = ListDigitalAssetsResponse['items'][number];
type DigitalAssetShareLinkRow = NonNullable<DigitalAssetDetail['shareLinks']>[number];
type DigitalAssetProductUsageRow = NonNullable<DigitalAssetDetail['productUsages']>[number];
type DigitalAssetVersionRow = DigitalAssetDetail['versions'][number];

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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<AssetTab>('library');
  const [viewMode, setViewMode] = useState<LibraryViewMode>('list');
  const [showAllAssets, setShowAllAssets] = useState(false);
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
  const [bulkUploadStep, setBulkUploadStep] = useState<BulkUploadStep>('select');
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isCollectionItemsModalOpen, setIsCollectionItemsModalOpen] = useState(false);
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
  const shareReadyAssets = useMemo(() => visibleAssets.filter((asset) => (
    asset.status === 'active'
    && asset.reviewStatus === 'approved'
    && Boolean(asset.currentVersion)
    && (asset.visibility === 'dealer_portal' || asset.visibility === 'public')
  )), [visibleAssets]);
  const displayedAssets = showAllAssets ? visibleAssets : shareReadyAssets;
  const deliveryHealthAssets = useMemo(
    () => assets.items.filter(
      (asset) => asset.reviewStatus !== 'approved' || !asset.currentVersion || (asset.activeShareLinkCount ?? 0) > 0,
    ),
    [assets.items],
  );
  const assetMetrics = useMemo(() => ({
    total: assets.total,
    ready: assets.items.filter((asset) => asset.status === 'active' && asset.reviewStatus === 'approved').length,
    shared: assets.items.filter((asset) => (asset.activeShareLinkCount ?? 0) > 0).length,
    productLinked: assets.items.filter((asset) => (asset.productUsageCount ?? 0) > 0).length,
  }), [assets.items, assets.total]);
  const canEditAssets = auth ? canPerformAction(auth.identity.role, 'digital_asset.edit') : false;
  const canShareAssets = auth ? canPerformAction(auth.identity.role, 'digital_asset.share') : false;
  const canUploadAssets = auth ? canPerformAction(auth.identity.role, 'digital_asset.upload') : false;
  const canSyncAssets = auth ? canPerformAction(auth.identity.role, 'digital_asset.sync') : false;
  const selectedAssetActiveShareLink = useMemo(() => (
    selectedAsset?.shareLinks?.find((shareLink) => !shareLink.revokedAt && (!shareLink.expiresAt || new Date(shareLink.expiresAt) > new Date())) ?? null
  ), [selectedAsset]);
  const selectedAssetCanShare = Boolean(
    selectedAsset
      && selectedAsset.currentVersion
      && (selectedAsset.visibility === 'dealer_portal' || selectedAsset.visibility === 'public')
      && (selectedAsset.reviewStatus === 'approved' || selectedAsset.reviewStatus === 'not_required'),
  );

  useEffect(() => {
    const tab = searchParams.get('tab') as AssetTab | null;
    if (tab && ['library', 'collections', 'migration', 'delivery-health'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

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
      setBulkUploadStep('select');
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

  const handleApproveAsset = async () => {
    if (!auth || !selectedAsset) return;
    setIsUpdatingAsset(true);
    setDetailError(null);
    try {
      await updateDigitalAssetRecord(apiBaseUrl, auth.tokens.accessToken, selectedAsset.id, {
        title: assetEditForm.title,
        description: emptyToNull(assetEditForm.description),
        status: assetEditForm.status,
        visibility: assetEditForm.visibility,
        reviewStatus: 'approved',
        audience: assetEditForm.audience,
        brandScope: emptyToNull(assetEditForm.brandScope),
        regionScope: emptyToNull(assetEditForm.regionScope),
        dealerGroupType: emptyToNull(assetEditForm.dealerGroupType),
        dealerGroupId: emptyToNull(assetEditForm.dealerGroupId),
      });
      await loadAssetDetail(selectedAsset.id);
      await reloadAssets();
    } catch (approveError) {
      setDetailError(approveError instanceof Error ? approveError.message : String(approveError));
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

  const handleCopyOrCreateCustomerLink = async () => {
    if (selectedAssetActiveShareLink) {
      await copyToClipboard(selectedAssetActiveShareLink.shareUrl);
      return;
    }
    await handleCreateShareLink();
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
    setIsCollectionModalOpen(true);
    goToAssetTab('collections');
  };

  const handleResetCollection = () => {
    setSelectedCollectionId(null);
    setCollectionForm(defaultCollectionForm);
    setIsCollectionModalOpen(false);
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

  const goToAssetTab = (nextTab: AssetTab) => {
    setActiveTab(nextTab);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('tab', nextTab);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  const openBulkUpload = () => {
    setBulkUploadStep('select');
    setIsBulkUploadOpen(true);
  };

  const closeBulkUpload = () => {
    setIsBulkUploadOpen(false);
    if (!isBulkUploading) {
      setBulkUploadStep('select');
    }
  };

  const handleBulkFileSelection = (files: File[]) => {
    setBulkUploadFiles(files);
    setBulkUploadStep(files.length ? 'review' : 'select');
  };

  const openCreateShareSet = () => {
    setSelectedCollectionId(null);
    setCollectionForm(defaultCollectionForm);
    setIsCollectionModalOpen(true);
  };

  const selectCollection = (collection: DigitalAssetCollectionSummary) => {
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
  };

  const openCollectionItems = (collection: DigitalAssetCollectionSummary) => {
    selectCollection(collection);
    setIsCollectionItemsModalOpen(true);
  };

  const handleReviewDeliveryHealthAsset = (assetId: string) => {
    goToAssetTab('library');
    void loadAssetDetail(assetId);
  };

  const handleReviewFirstDeliveryHealthItem = () => {
    const [firstAsset] = deliveryHealthAssets;
    if (!firstAsset) return;
    handleReviewDeliveryHealthAsset(firstAsset.id);
  };

  const headerPrimaryAction = activeTab === 'library' ? (
    <Button
      variant="filled"
      leftSection={<IconShare size={16} />}
      onClick={() => void handleCopyOrCreateCustomerLink()}
      loading={isCreatingShareLink}
      disabled={!canShareAssets || !selectedAsset || !selectedAssetCanShare}
    >
      {selectedAssetActiveShareLink ? 'Copy customer link' : 'Create share link'}
    </Button>
  ) : activeTab === 'collections' && canEditAssets ? (
    <Button variant="filled" leftSection={<IconPlus size={16} />} onClick={openCreateShareSet}>
      Create Share Set
    </Button>
  ) : activeTab === 'delivery-health' ? (
    <Button
      variant="filled"
      leftSection={<IconAlertTriangle size={16} />}
      onClick={handleReviewFirstDeliveryHealthItem}
      disabled={!deliveryHealthAssets.length}
    >
      Review Items
    </Button>
  ) : activeTab === 'migration' && canSyncAssets ? (
    <Button variant="filled" leftSection={<IconCloudUpload size={16} />} onClick={handlePreviewImport} loading={isPreviewingImport}>
      Preview Import
    </Button>
  ) : null;

  const headerMoreItems: WorkbenchMenuItem[] = [
    ...(canUploadAssets
      ? [{
        id: 'upload-files',
        label: 'Upload Files',
        icon: <IconCloudUpload size={16} />,
        onClick: openBulkUpload,
      }]
      : []),
    ...(canUploadAssets ? [{
      id: 'add-file-link',
      label: 'Add File Link',
      icon: <IconPlus size={16} />,
      onClick: () => setIsAddLinkOpen(true),
    }] : []),
    ...(activeTab === 'library' ? [{
      id: 'review-all-files',
      label: showAllAssets ? 'Show Share-Ready Files' : 'Review All Files',
      icon: <IconFilter size={16} />,
      onClick: () => setShowAllAssets((current) => !current),
    }] : []),
    ...(canEditAssets && activeTab !== 'collections'
      ? [{
        id: 'create-share-set',
        label: 'Create Share Set',
        icon: <IconShare size={16} />,
        onClick: openCreateShareSet,
      }]
      : []),
    ...(canSyncAssets && activeTab === 'migration'
      ? [{
        id: 'load-import-runs',
        label: isLoadingRuns ? 'Loading Previous Runs...' : 'Load Previous Runs',
        icon: <IconHistory size={16} />,
        disabled: isLoadingRuns,
        onClick: handleLoadImportRuns,
      }]
      : []),
  ];

  return (
    <Stack gap="lg">
      <WorkbenchHeader
        title="Digital Assets"
        description="Manage product photos, brochures, spec sheets, videos, and shareable customer links from one library."
        policyText="Customer links are revocable and access-aware."
        primaryAction={headerPrimaryAction}
        secondaryActions={<WorkbenchMoreMenu items={headerMoreItems} />}
      />

      {error ? (
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Asset library unavailable">
          {error}
        </Alert>
      ) : null}

      <Tabs
        value={activeTab}
        onChange={(value) => goToAssetTab((value as AssetTab | null) ?? 'library')}
        keepMounted={false}
      >
        <Tabs.List>
          <Tabs.Tab value="library" leftSection={<IconPhoto size={16} />}>Library</Tabs.Tab>
          <Tabs.Tab value="collections">Share Sets</Tabs.Tab>
          <Tabs.Tab value="delivery-health">Delivery Health</Tabs.Tab>
          {canSyncAssets ? <Tabs.Tab value="migration">Migration</Tabs.Tab> : null}
        </Tabs.List>

        <Tabs.Panel value="library" pt="md">
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
              <Stack gap="md">
                <Paper withBorder p="md">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={2}>
                        <Title order={4}>Find and share approved files</Title>
                        <Text c="dimmed" size="sm">
                          Showing approved dealer/customer files first. Use More for upload cleanup, internal files, and review work.
                        </Text>
                      </Stack>
                      <Group gap="xs">
                        <SegmentedControl
                          value={viewMode}
                          onChange={(value) => setViewMode(value as LibraryViewMode)}
                          data={[
                            { label: 'Cards', value: 'cards' },
                            { label: 'List', value: 'list' },
                          ]}
                        />
                      </Group>
                    </Group>
                    <SimpleGrid cols={{ base: 1, sm: 3 }}>
                      <TextInput
                        leftSection={<IconSearch size={16} />}
                        placeholder="Search approved files"
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
                      {showAllAssets ? (
                        <Select
                          placeholder="All visibility"
                          data={visibilityOptions}
                          value={visibilityFilter}
                          onChange={(value) => setVisibilityFilter(value as DigitalAssetVisibilityKey | null)}
                          clearable
                        />
                      ) : null}
                    </SimpleGrid>
                  </Stack>
                </Paper>

              <Paper withBorder p={viewMode === 'cards' ? 'md' : 0}>
                {isLoading ? (
                  <Group justify="center" p="xl"><Loader /></Group>
                ) : viewMode === 'cards' ? (
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    {displayedAssets.map((asset) => (
                      <Paper
                        key={asset.id}
                        withBorder
                        p="md"
                        data-testid={`asset-open-${asset.stableSlug}`}
                        onClick={() => loadAssetDetail(asset.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Stack gap="sm">
                          <Group justify="space-between" align="flex-start">
                            <Stack gap={2}>
                              <Text fw={700}>{asset.title}</Text>
                              <Text size="xs" c="dimmed">{asset.currentVersion?.fileName ?? 'No file attached'}</Text>
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
                            <Badge color={selectedAsset?.id === asset.id ? 'blue' : 'gray'} variant="light">
                              {isLoadingDetail && selectedAsset?.id === asset.id ? 'Loading' : selectedAsset?.id === asset.id ? 'Selected' : 'Select'}
                            </Badge>
                          </Group>
                        </Stack>
                      </Paper>
                    ))}
                    {!displayedAssets.length ? (
                      <Paper withBorder p="xl">
                        <EmptyStateMessage
                          kind={search || kindFilter || visibilityFilter ? 'filtered-out' : 'no-data'}
                          title="No assets found"
                          description={search || kindFilter || visibilityFilter ? 'Adjust the search or filters to see more library assets.' : showAllAssets ? 'Upload files or add a file link to start the library.' : 'Approved share-ready files will appear here after review.'}
                          action={(
                            <Group>
                              <Button variant="light" leftSection={<IconFilter size={16} />} onClick={() => setShowAllAssets(true)}>Review all files</Button>
                            </Group>
                          )}
                        />
                      </Paper>
                    ) : null}
                  </SimpleGrid>
                ) : (
                  <WorkbenchTable<DigitalAssetLibraryRow>
                    ariaLabel="Digital asset library list"
                    minWidth={880}
                    rows={displayedAssets}
                    getRowKey={(asset) => asset.id}
                    onRowClick={(asset) => loadAssetDetail(asset.id)}
                    columns={[
                      {
                        key: 'asset',
                        header: 'Asset',
                        render: (asset) => (
                          <Stack gap={2}>
                            <Text fw={600}>{asset.title}</Text>
                            <Text size="xs" c="dimmed">{asset.currentVersion?.fileName ?? 'No file attached'}</Text>
                          </Stack>
                        ),
                      },
                      {
                        key: 'type-access',
                        header: 'Type / Access',
                        render: (asset) => (
                          <Stack gap={4}>
                            <Text size="sm">{formatLabel(asset.kind)}</Text>
                            <Badge variant="light">{formatLabel(asset.visibility)}</Badge>
                          </Stack>
                        ),
                      },
                      {
                        key: 'scope',
                        header: 'Brand / Region',
                        render: (asset) => [asset.brandScope, asset.regionScope].filter(Boolean).join(' / ') || 'Unscoped',
                      },
                      {
                        key: 'usage',
                        header: 'Usage',
                        align: 'right',
                        render: (asset) => asset.productUsageCount ?? 0,
                      },
                      {
                        key: 'shares',
                        header: 'Shares',
                        render: (asset) => `${asset.activeShareLinkCount ?? 0} active / ${asset.totalShareLinkAccessCount ?? 0} views`,
                      },
                    ]}
                    emptyState={(
                      <EmptyStateMessage
                        kind={search || kindFilter || visibilityFilter ? 'filtered-out' : 'no-data'}
                        title="No assets found"
                        description={search || kindFilter || visibilityFilter ? 'Adjust the search or filters to see more library assets.' : showAllAssets ? 'Upload files or add a file link to start the library.' : 'Approved share-ready files will appear here after review.'}
                      />
                    )}
                  />
                )}
              </Paper>
              </Stack>

              <Stack gap="md">
                <WorkbenchDetailRail
                  title="Asset detail"
                  description="Review files, product usage, and share links for the selected asset."
                >
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
                      onApprove={handleApproveAsset}
                      onCreateShareLink={handleCreateShareLink}
                      onRevokeShareLink={handleRevokeShareLink}
                      onSubmit={handleAddVersion}
                    />
                  ) : (
                    <EmptyStateMessage
                      kind="no-data"
                      title="Select an asset"
                      description="Select an approved file to copy a customer link, create a revocable share link, or review product usage."
                    />
                  )}
                </WorkbenchDetailRail>
              </Stack>
            </SimpleGrid>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="collections" pt="md">
          <Stack gap="lg">
            <Paper withBorder p="md">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Title order={4}>Share Sets</Title>
                  <Text size="sm" c="dimmed">Review grouped files first; create, edit, and membership changes stay in More or setup drawers.</Text>
                </Stack>
                <WorkbenchMoreMenu
                  items={[
                    {
                      id: 'open-library',
                      label: 'Select Assets From Library',
                      onClick: () => goToAssetTab('library'),
                    },
                  ]}
                />
              </Group>
            </Paper>
            <WorkbenchTable<DigitalAssetCollectionSummary>
              ariaLabel="Digital asset share sets"
              rows={collections.items}
              getRowKey={(collection) => collection.id}
              onRowClick={selectCollection}
              columns={[
                {
                  key: 'share-set',
                  header: 'Share Set',
                  render: (collection) => (
                    <Stack gap={2}>
                        <Text fw={600}>{collection.name}</Text>
                        <Text size="xs" c="dimmed">{collection.code}</Text>
                    </Stack>
                  ),
                },
                { key: 'access', header: 'Access', render: (collection) => formatLabel(collection.visibility) },
                { key: 'items', header: 'Items', align: 'right', render: (collection) => collection.itemCount ?? 0 },
                {
                  key: 'status',
                  header: 'Status',
                  render: (collection) => (
                    <Badge color={collection.isActive ? 'green' : 'gray'} variant="light">{collection.isActive ? 'Active' : 'Inactive'}</Badge>
                  ),
                },
              ]}
              rowActions={(collection) => ([
                {
                  id: 'edit-share-set',
                  label: 'Edit share set',
                  onClick: () => handleEditCollection(collection),
                },
                {
                  id: 'manage-items',
                  label: 'Manage share set items',
                  onClick: () => openCollectionItems(collection),
                },
              ])}
              emptyState={(
                <EmptyStateMessage
                  kind="no-data"
                  title="No share sets configured yet"
                  description="Create a share set when several files should be sent together."
                />
              )}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="migration" pt="md">
          <Stack gap="md">
            <Paper withBorder p="md">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Title order={4}>Migration Review</Title>
                    <Text c="dimmed">Preview Widen files before they are added to the Pulse asset library.</Text>
                  </Stack>
                </Group>

                <Alert color="gray" title="Advanced migration trace">
                  This checks Widen IDs, asset names, original URLs, and issue counts. Public Widen redirect cutover is held for the approved migration plan.
                </Alert>

                {migrationError ? (
                  <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Legacy import unavailable">
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

        <Tabs.Panel value="delivery-health" pt="md">
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
              <Metric label="Ready Assets" value={assetMetrics.ready} />
              <Metric label="Needs Review" value={assets.items.filter((asset) => asset.reviewStatus !== 'approved').length} />
              <Metric label="Missing Files" value={assets.items.filter((asset) => !asset.currentVersion).length} />
              <Metric label="Active Shares" value={assetMetrics.shared} />
            </SimpleGrid>
            <Alert color="blue" title="Asset delivery checks">
              Review assets that are not approved, do not have a current file, or are being shared externally.
            </Alert>
            <WorkbenchTable<DigitalAssetLibraryRow>
              ariaLabel="Digital asset delivery health"
              rows={deliveryHealthAssets}
              getRowKey={(asset) => asset.id}
              onRowClick={(asset) => handleReviewDeliveryHealthAsset(asset.id)}
              columns={[
                {
                  key: 'asset',
                  header: 'Asset',
                  render: (asset) => (
                    <Stack gap={2}>
                      <Text fw={600}>{asset.title}</Text>
                      <Text size="xs" c="dimmed">{asset.currentVersion?.fileName ?? 'No file attached'}</Text>
                    </Stack>
                  ),
                },
                {
                  key: 'file',
                  header: 'File',
                  render: (asset) => asset.currentVersion ? (
                    <Badge color="green" variant="light">Current file ready</Badge>
                  ) : (
                    <Badge color="red" variant="light">Missing file</Badge>
                  ),
                },
                {
                  key: 'review',
                  header: 'Review',
                  render: (asset) => (
                    <Badge color={asset.reviewStatus === 'approved' ? 'green' : 'yellow'} variant="light">
                      {formatLabel(asset.reviewStatus)}
                    </Badge>
                  ),
                },
                {
                  key: 'sharing',
                  header: 'Sharing',
                  render: (asset) => `${asset.activeShareLinkCount ?? 0} active links`,
                },
              ]}
              rowActions={(asset) => [{
                id: 'review-asset',
                label: 'Review asset',
                onClick: () => handleReviewDeliveryHealthAsset(asset.id),
              }]}
              emptyState={(
                <EmptyStateMessage
                  kind="all-clear"
                  title="No delivery health items need attention"
                />
              )}
            />
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={isCollectionModalOpen}
        onClose={handleResetCollection}
        title={selectedCollectionId ? 'Edit Share Set' : 'Create Share Set'}
        size="xl"
        centered
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">Name the file set, choose who can see it, then add the brand or region when the set is scoped.</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Set name" value={collectionForm.name} onChange={(event) => setCollectionForm((current) => ({ ...current, name: event.currentTarget.value }))} />
            <Select label="Who can see this set" data={visibilityOptions} value={collectionForm.visibility} onChange={(value) => setCollectionForm((current) => ({ ...current, visibility: (value as DigitalAssetVisibilityKey | null) ?? 'internal_only' }))} allowDeselect={false} />
            <TextInput label="Set code" value={collectionForm.code} onChange={(event) => setCollectionForm((current) => ({ ...current, code: event.currentTarget.value }))} />
            <TextInput label="Brand" value={collectionForm.brandScope} onChange={(event) => setCollectionForm((current) => ({ ...current, brandScope: event.currentTarget.value }))} />
            <TextInput label="Region" value={collectionForm.regionScope} onChange={(event) => setCollectionForm((current) => ({ ...current, regionScope: event.currentTarget.value }))} />
            <Checkbox mt="xl" label="Active" checked={collectionForm.isActive} onChange={(event) => setCollectionForm((current) => ({ ...current, isActive: event.currentTarget.checked }))} />
          </SimpleGrid>
          <WorkbenchAdvancedSection
            title="Advanced catalog visibility"
            description="Use only when this share set is limited to a specific dealer group or scoped audience."
          >
            <SimpleGrid cols={{ base: 1, sm: 2 }} mt="sm">
              <TextInput label="Catalog audience type" value={collectionForm.dealerGroupType} onChange={(event) => setCollectionForm((current) => ({ ...current, dealerGroupType: event.currentTarget.value }))} />
              <TextInput label="Catalog audience code" value={collectionForm.dealerGroupId} onChange={(event) => setCollectionForm((current) => ({ ...current, dealerGroupId: event.currentTarget.value }))} />
            </SimpleGrid>
          </WorkbenchAdvancedSection>
          <Textarea label="Description" minRows={2} value={collectionForm.description} onChange={(event) => setCollectionForm((current) => ({ ...current, description: event.currentTarget.value }))} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleResetCollection}>Cancel</Button>
            <Button onClick={handleSaveCollection} loading={isSavingCollection} disabled={!collectionForm.code.trim() || !collectionForm.name.trim()}>
              {selectedCollectionId ? 'Save Share Set' : 'Create Share Set'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={isCollectionItemsModalOpen}
        onClose={() => setIsCollectionItemsModalOpen(false)}
        title="Manage Share Set Items"
        size="lg"
        centered
      >
        <Stack gap="sm">
          <Title order={4}>Selected File</Title>
          <Text size="sm" c="dimmed">{selectedAsset ? selectedAsset.title : 'Choose a file in the Library tab before changing share set membership.'}</Text>
          <Select
            label="Share set"
            data={collections.items.map((collection) => ({ value: collection.id, label: collection.name }))}
            value={selectedCollectionId}
            onChange={setSelectedCollectionId}
            searchable
            clearable
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setIsCollectionItemsModalOpen(false)}>Close</Button>
            <Button onClick={handleAddSelectedAssetToCollection} loading={isUpdatingCollectionItem} disabled={!selectedAsset || !selectedCollectionId}>
              Add File
            </Button>
            <Button variant="light" color="red" onClick={handleRemoveSelectedAssetFromCollection} loading={isUpdatingCollectionItem} disabled={!selectedAsset || !selectedCollectionId}>
              Remove File
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={isAddLinkOpen} onClose={() => setIsAddLinkOpen(false)} title="Add File Link" size="lg" centered>
        <form onSubmit={handleCreateAsset}>
          <Stack gap="sm" data-testid="asset-share-panel">
            <Text c="dimmed" size="sm">Paste a file link, choose who can access it, then save it to the library.</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="File name"
                data-testid="asset-link-name"
                value={assetForm.title}
                onChange={(event) => setAssetForm((current) => ({ ...current, title: event.currentTarget.value }))}
                required
              />
              <Select
                label="Who can access"
                aria-label="Asset link access"
                data-testid="asset-link-access"
                value={assetForm.visibility}
                data={visibilityOptions}
                onChange={(value) => setAssetForm((current) => ({ ...current, visibility: (value as DigitalAssetVisibilityKey) ?? 'internal_only' }))}
                allowDeselect={false}
              />
              <TextInput
                label="Paste file link"
                data-testid="asset-link-url"
                value={assetForm.externalUrl}
                onChange={(event) => setAssetForm((current) => ({ ...current, externalUrl: event.currentTarget.value }))}
                placeholder="https://..."
              />
              <Select
                label="Type"
                value={assetForm.kind}
                data={kindOptions}
                onChange={(value) => setAssetForm((current) => ({ ...current, kind: (value as DigitalAssetKindKey) ?? 'image' }))}
                allowDeselect={false}
              />
              <TextInput
                label="Attached file name"
                data-testid="asset-link-file-name"
                value={assetForm.fileName}
                onChange={(event) => setAssetForm((current) => ({ ...current, fileName: event.currentTarget.value }))}
                placeholder="Required when link is provided"
              />
              <TextInput
                label="Use for"
                data-testid="asset-link-audience"
                value={assetForm.audience}
                onChange={(event) => setAssetForm((current) => ({ ...current, audience: event.currentTarget.value }))}
              />
            </SimpleGrid>
            <Textarea
              label="Notes"
              data-testid="asset-link-notes"
              value={assetForm.description}
              onChange={(event) => setAssetForm((current) => ({ ...current, description: event.currentTarget.value }))}
              minRows={2}
            />
            <WorkbenchAdvancedSection
              title="Advanced file details"
              description="Use when preserving a custom slug, file type, brand/region scope, or original Widen link."
            >
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
            </WorkbenchAdvancedSection>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setIsAddLinkOpen(false)}>Cancel</Button>
              <Button leftSection={<IconPlus size={16} />} type="submit" loading={isCreatingAsset} disabled={!assetForm.title.trim() || Boolean(assetForm.externalUrl.trim() && !assetForm.fileName.trim())}>
                Add File Link
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={isBulkUploadOpen} onClose={closeBulkUpload} title="Upload Files" size="xl" centered>
        <Stack gap="md">
          <SegmentedControl
            value={bulkUploadStep}
            onChange={(value) => {
              const nextStep = value as BulkUploadStep;
              if (nextStep === 'select' || bulkUploadFiles.length) {
                setBulkUploadStep(nextStep);
              }
            }}
            data={[
              { value: 'select', label: '1. Select files' },
              { value: 'review', label: '2. Review details' },
              { value: 'defaults', label: '3. Apply defaults' },
            ]}
            fullWidth
          />

          {bulkUploadStep === 'select' ? (
          <Paper
            withBorder
            p="lg"
            style={{ borderStyle: 'dashed' }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleBulkFileSelection(Array.from(event.dataTransfer.files ?? []));
            }}
          >
            <Stack gap="sm" align="center">
              <IconCloudUpload size={32} />
              <Stack gap={2} align="center">
                <Title order={4}>Drop files here or choose from your computer</Title>
                <Text size="sm" c="dimmed" ta="center">Upload product photos, brochures, spec sheets, presentations, or videos in one batch.</Text>
              </Stack>
              <input
                ref={bulkFileInputRef}
                type="file"
                multiple
                hidden
                onChange={(event) => handleBulkFileSelection(Array.from(event.currentTarget.files ?? []))}
              />
              <Group>
                <Button variant="light" onClick={() => bulkFileInputRef.current?.click()}>
                  Choose Files
                </Button>
                {bulkUploadFiles.length ? (
                  <Button variant="subtle" color="red" onClick={() => handleBulkFileSelection([])}>
                    Clear
                  </Button>
                ) : null}
              </Group>
              <Text size="sm" c="dimmed">{bulkUploadFiles.length ? `${bulkUploadFiles.length} file${bulkUploadFiles.length === 1 ? '' : 's'} selected` : 'No files selected yet'}</Text>
            </Stack>
          </Paper>
          ) : null}

          {bulkUploadStep === 'review' ? (
          <Stack gap="sm">
            <Group justify="space-between">
              <Stack gap={2}>
                <Title order={4}>Review file details</Title>
                <Text size="sm" c="dimmed">Pulse detected file type and size. Confirm the batch before applying shared defaults.</Text>
              </Stack>
              <Badge variant="light">{bulkUploadFiles.length} selected</Badge>
            </Group>
            <WorkbenchTable<File>
              ariaLabel="Bulk upload file review"
              rows={bulkUploadFiles}
              getRowKey={(file) => `${file.name}-${file.size}-${file.lastModified}`}
              minWidth={680}
              columns={[
                {
                  key: 'file',
                  header: 'File',
                  render: (file) => (
                    <Stack gap={2}>
                      <Text fw={600}>{file.name}</Text>
                      <Text size="xs" c="dimmed">{file.type || 'Unknown MIME type'}</Text>
                    </Stack>
                  ),
                },
                {
                  key: 'detected-type',
                  header: 'Detected type',
                  render: (file) => formatLabel(inferAssetKind(file.type, bulkUploadForm.kind)),
                },
                {
                  key: 'size',
                  header: 'Size',
                  render: (file) => formatBytes(file.size),
                  align: 'right',
                },
              ]}
              emptyState={(
                <EmptyStateMessage
                  kind="no-data"
                  title="No files selected"
                  description="Choose files first, then review detected details."
                />
              )}
            />
          </Stack>
          ) : null}

          {bulkUploadStep === 'defaults' ? (
          <Stack gap="sm">
          <Group justify="space-between">
            <Stack gap={2}>
              <Title order={4}>Apply defaults</Title>
              <Text size="sm" c="dimmed">These defaults will be applied to every selected file. You can edit individual assets after upload.</Text>
            </Stack>
            <Badge variant="light">{bulkUploadFiles.length} ready to upload</Badge>
          </Group>
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
          </Stack>
          ) : null}

          <Group justify="flex-end">
            <Button variant="default" onClick={closeBulkUpload}>Cancel</Button>
            {bulkUploadStep !== 'select' ? (
              <Button
                variant="subtle"
                onClick={() => setBulkUploadStep(bulkUploadStep === 'defaults' ? 'review' : 'select')}
              >
                Back
              </Button>
            ) : null}
            {bulkUploadStep === 'select' ? (
              <Button onClick={() => setBulkUploadStep('review')} disabled={!bulkUploadFiles.length}>
                Review Details
              </Button>
            ) : null}
            {bulkUploadStep === 'review' ? (
              <Button onClick={() => setBulkUploadStep('defaults')} disabled={!bulkUploadFiles.length}>
                Apply Defaults
              </Button>
            ) : null}
            {bulkUploadStep === 'defaults' ? (
            <Button leftSection={<IconCloudUpload size={16} />} onClick={handleBulkUpload} loading={isBulkUploading} disabled={!bulkUploadFiles.length}>
              Upload {bulkUploadFiles.length || ''} File{bulkUploadFiles.length === 1 ? '' : 's'}
            </Button>
            ) : null}
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
  onApprove,
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
  onApprove: () => void;
  onCreateShareLink: () => void;
  onRevokeShareLink: (shareLinkId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const currentUrl = asset.currentVersion?.publicUrl ?? asset.currentVersion?.externalUrl;
  const isShareable = asset.visibility === 'dealer_portal' || asset.visibility === 'public';
  const hasCurrentFile = Boolean(asset.currentVersion);
  const reviewAllowsSharing = asset.reviewStatus === 'approved' || asset.reviewStatus === 'not_required';
  const activeShareLink = asset.shareLinks?.find((shareLink) => !shareLink.revokedAt && (!shareLink.expiresAt || new Date(shareLink.expiresAt) > new Date())) ?? null;
  const [showAdvancedShareContext, setShowAdvancedShareContext] = useState(Boolean(shareForm.contextType || shareForm.contextId));
  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Title order={4}>{asset.title}</Title>
          <Text c="dimmed" size="sm">{asset.currentVersion?.fileName ?? 'No current file'}</Text>
        </Stack>
        <Badge variant="light">{formatLabel(asset.status)} / {formatLabel(asset.reviewStatus)}</Badge>
      </Group>

      {currentUrl && (asset.kind === 'image' || asset.currentVersion?.mimeType?.startsWith('image/')) ? (
        <Paper withBorder p={0} style={{ overflow: 'hidden', borderRadius: 8 }}>
          <img
            src={currentUrl}
            alt={asset.title}
            style={{ width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block' }}
          />
        </Paper>
      ) : null}

      <Group gap="xs">
        {canShare ? (
          <Button
            data-testid="asset-share-create-link"
            size="xs"
            leftSection={<IconShare size={14} />}
            onClick={() => activeShareLink ? copyToClipboard(activeShareLink.shareUrl) : onCreateShareLink()}
            loading={!activeShareLink && isCreatingShareLink}
            disabled={!hasCurrentFile || !isShareable || !reviewAllowsSharing}
          >
            {activeShareLink ? 'Copy customer link' : 'Create share link'}
          </Button>
        ) : null}
        {currentUrl ? (
          <Button
            component="a"
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            size="xs"
            variant="light"
            leftSection={<IconLink size={14} />}
          >
            Open file
          </Button>
        ) : null}
        {canEdit && asset.reviewStatus !== 'approved' && asset.reviewStatus !== 'not_required' ? (
          <Button
            size="xs"
            color="green"
            variant="light"
            onClick={onApprove}
            loading={isUpdatingAsset}
          >
            Approve
          </Button>
        ) : null}
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <CountLine label="Type" value={formatLabel(asset.kind)} />
        <CountLine label="Access" value={formatLabel(asset.visibility)} />
        <CountLine label="Used by products" value={String(asset.productUsageCount ?? 0)} />
        <CountLine label="Active shares" value={`${asset.activeShareLinkCount ?? 0} links / ${asset.totalShareLinkAccessCount ?? 0} views`} />
      </SimpleGrid>

      {asset.description ? <Text size="sm">{asset.description}</Text> : null}
      {canShare ? (
        <WorkbenchAdvancedSection
          title="Share options and link history"
          description="Name a recipient, set expiry, add CRM context, or revoke links when needed."
        >
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Title order={5}>Share this file</Title>
                <Text c="dimmed" size="sm">Choose who receives the link, set an expiry, then create a revocable customer or dealer link.</Text>
              </Stack>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <AssetShareStep
                label="1. File"
                value={hasCurrentFile ? 'Ready' : 'Needs file'}
                detail={hasCurrentFile ? asset.currentVersion?.fileName ?? 'Current file selected' : 'Add or upload a current version first'}
                tone={hasCurrentFile ? 'ready' : 'attention'}
              />
              <AssetShareStep
                label="2. Access"
                value={isShareable && reviewAllowsSharing ? 'Shareable' : !reviewAllowsSharing ? 'Needs approval' : 'Internal only'}
                detail={isShareable && reviewAllowsSharing ? 'Dealer/customer link creation is allowed' : !reviewAllowsSharing ? 'Approve the asset before sharing externally' : 'Change access to Dealer Portal or Public before sharing'}
                tone={isShareable && reviewAllowsSharing ? 'ready' : 'attention'}
              />
              <AssetShareStep
                label="3. Recipient"
                value={shareForm.recipientEmail || shareForm.recipientName ? 'Named' : 'Optional'}
                detail="Name or email keeps the share auditable"
                tone="ready"
              />
            </SimpleGrid>
            {!hasCurrentFile ? (
              <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
                Add or upload a current file before creating a customer link.
              </Alert>
            ) : null}
            {hasCurrentFile && !isShareable ? (
              <Alert color="blue" title="Make this asset shareable first">
                <Stack gap="xs">
                  <Text size="sm">
                    This asset is internal-only. Change access to Dealer Portal or Public, then create a customer or prospect link.
                  </Text>
                  {canEdit ? (
                    <Group>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => onEditFormChange({ ...editForm, visibility: 'dealer_portal' })}
                      >
                        Set to Dealer Portal
                      </Button>
                      <Button size="xs" onClick={onUpdateAsset} loading={isUpdatingAsset}>
                        Save Access
                      </Button>
                    </Group>
                  ) : null}
                </Stack>
              </Alert>
            ) : null}
            {hasCurrentFile && isShareable && !reviewAllowsSharing ? (
              <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Approval needed before sharing">
                Customer links can be created after this asset is approved or marked review-not-required.
              </Alert>
            ) : null}
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
                aria-label="Share expires in days"
                min={1}
                max={365}
                value={shareForm.expiresInDays}
                onChange={(value) => onShareFormChange({ ...shareForm, expiresInDays: typeof value === 'number' ? value : 30 })}
              />
              <TextInput data-testid="asset-share-recipient-name" label="Recipient name" value={shareForm.recipientName} onChange={(event) => onShareFormChange({ ...shareForm, recipientName: event.currentTarget.value })} />
              <TextInput data-testid="asset-share-recipient-email" label="Recipient email" value={shareForm.recipientEmail} onChange={(event) => onShareFormChange({ ...shareForm, recipientEmail: event.currentTarget.value })} />
            </SimpleGrid>
            <Checkbox
              label="Add CRM context for this share"
              description="Optional. Use only when linking this share to a specific lead, account, proposal, or internal review."
              checked={showAdvancedShareContext}
              onChange={(event) => setShowAdvancedShareContext(event.currentTarget.checked)}
            />
            {showAdvancedShareContext ? (
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Context type" placeholder="lead, account, proposal, internal review" value={shareForm.contextType} onChange={(event) => onShareFormChange({ ...shareForm, contextType: event.currentTarget.value })} />
                <TextInput label="Context ID" placeholder="Paste the CRM record ID when available" value={shareForm.contextId} onChange={(event) => onShareFormChange({ ...shareForm, contextId: event.currentTarget.value })} />
              </SimpleGrid>
            ) : null}
            <Textarea data-testid="asset-share-note" label="Note" minRows={2} value={shareForm.note} onChange={(event) => onShareFormChange({ ...shareForm, note: event.currentTarget.value })} />

            <WorkbenchTable<DigitalAssetShareLinkRow>
              ariaLabel="Asset share links"
              rows={asset.shareLinks ?? []}
              getRowKey={(shareLink) => shareLink.id}
              minWidth={680}
              withContainer={false}
              columns={[
                {
                  key: 'recipient',
                  header: 'Recipient',
                  render: (shareLink) => (
                    <Stack gap={2}>
                      <Text size="sm" fw={600}>{shareLink.recipientName || shareLink.recipientEmail || formatLabel(shareLink.recipientType)}</Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>{shareLink.shareUrl}</Text>
                    </Stack>
                  ),
                },
                {
                  key: 'expires',
                  header: 'Expires',
                  render: (shareLink) => shareLink.expiresAt ? formatDate(shareLink.expiresAt) : 'No expiry',
                },
                {
                  key: 'access',
                  header: 'Access',
                  render: (shareLink) => shareLink.accessCount,
                  align: 'right',
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (shareLink) => (
                    <Badge color={shareLink.revokedAt ? 'gray' : 'green'} variant="light">
                      {shareLink.revokedAt ? 'Revoked' : 'Active'}
                    </Badge>
                  ),
                },
              ]}
              rowActions={(shareLink) => [
                {
                  id: 'copy-share-link',
                  label: 'Copy link',
                  onClick: () => copyToClipboard(shareLink.shareUrl),
                },
                ...(!shareLink.revokedAt ? [{
                  id: 'revoke-share-link',
                  label: revokingShareLinkId === shareLink.id ? 'Revoking...' : 'Revoke link',
                  color: 'red' as const,
                  disabled: revokingShareLinkId === shareLink.id,
                  onClick: () => onRevokeShareLink(shareLink.id),
                }] : []),
              ]}
              emptyState={(
                <EmptyStateMessage
                  kind="no-data"
                  title="No share links created yet"
                  description="Create a link when a prospect, customer, or dealer needs this file."
                />
              )}
            />
          </Stack>
        </WorkbenchAdvancedSection>
      ) : null}

      <WorkbenchAdvancedSection
        title="Product usage"
        description={`${asset.productUsageCount ?? 0} linked product presentation${asset.productUsageCount === 1 ? '' : 's'}. Expand when reviewing catalog impact.`}
      >
        {(() => {
          const mismatchCount = (asset.productUsages ?? []).filter(
            (u) => asset.brandScope && u.brandLabel && u.brandLabel !== asset.brandScope,
          ).length;
          return mismatchCount > 0 ? (
            <Alert color="orange" icon={<IconAlertTriangle size={16} />} title="Brand mismatch on product usage" mb="sm">
              This asset is scoped to the <strong>{asset.brandScope}</strong> brand but is linked to {mismatchCount} product presentation{mismatchCount === 1 ? '' : 's'} using a different brand label. Review or re-scope.
            </Alert>
          ) : null;
        })()}
          <WorkbenchTable<DigitalAssetProductUsageRow>
            ariaLabel="Asset product usage"
            rows={asset.productUsages ?? []}
            getRowKey={(usage) => usage.id}
            minWidth={680}
            withContainer={false}
            columns={[
              {
                key: 'product',
                header: 'Product',
                render: (usage) => (
                  <Stack gap={2}>
                    <Text size="sm" fw={600}>{usage.presentationName}</Text>
                    <Text size="xs" c="dimmed">{usage.productSku} / {usage.productName}</Text>
                  </Stack>
                ),
              },
              {
                key: 'role',
                header: 'Role',
                render: (usage) => formatLabel(usage.role),
              },
              {
                key: 'scope',
                header: 'Scope',
                render: (usage) => [usage.brandLabel, usage.regionScope, usage.dealerGroupId].filter(Boolean).join(' / ') || 'Unscoped',
              },
              {
                key: 'required',
                header: 'Required',
                render: (usage) => usage.isRequired ? 'Yes' : 'No',
              },
            ]}
            emptyState={(
              <EmptyStateMessage
                kind="no-data"
                title="This asset is not linked to any product presentation yet"
                description="Attach it from Product Management when it should appear in catalog or dealer portal content."
              />
            )}
          />
      </WorkbenchAdvancedSection>

      {canEdit ? (
        <WorkbenchAdvancedSection
          title="Marketing details"
          description="Edit the business-facing title, access, audience, and review state."
        >
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Group justify="space-between">
              <Title order={5}>File Details</Title>
              <Button onClick={onUpdateAsset} loading={isUpdatingAsset} disabled={!editForm.title.trim()}>
                Save Asset
              </Button>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Title" value={editForm.title} onChange={(event) => onEditFormChange({ ...editForm, title: event.currentTarget.value })} />
              <TextInput label="Audience" value={editForm.audience} onChange={(event) => onEditFormChange({ ...editForm, audience: event.currentTarget.value })} />
              <Select label="Status" data={statusOptions} value={editForm.status} onChange={(value) => onEditFormChange({ ...editForm, status: (value as DigitalAssetStatusKey | null) ?? 'draft' })} allowDeselect={false} />
              <Select label="Who can see this asset" data={visibilityOptions} value={editForm.visibility} onChange={(value) => onEditFormChange({ ...editForm, visibility: (value as DigitalAssetVisibilityKey | null) ?? 'internal_only' })} allowDeselect={false} />
              <Select label="Review" data={reviewStatusOptions} value={editForm.reviewStatus} onChange={(value) => onEditFormChange({ ...editForm, reviewStatus: (value as DigitalAssetReviewStatusKey | null) ?? 'pending_review' })} allowDeselect={false} />
              <TextInput label="Brand" value={editForm.brandScope} onChange={(event) => onEditFormChange({ ...editForm, brandScope: event.currentTarget.value })} />
              <TextInput label="Region" value={editForm.regionScope} onChange={(event) => onEditFormChange({ ...editForm, regionScope: event.currentTarget.value })} />
            </SimpleGrid>
            <WorkbenchAdvancedSection
              title="Advanced catalog visibility"
              description="Use only when this asset is limited to a specific dealer group or scoped audience."
            >
              <SimpleGrid cols={{ base: 1, sm: 2 }} mt="sm">
                <TextInput label="Catalog audience type" value={editForm.dealerGroupType} onChange={(event) => onEditFormChange({ ...editForm, dealerGroupType: event.currentTarget.value })} />
                <TextInput label="Catalog audience code" value={editForm.dealerGroupId} onChange={(event) => onEditFormChange({ ...editForm, dealerGroupId: event.currentTarget.value })} />
              </SimpleGrid>
            </WorkbenchAdvancedSection>
            <Textarea label="Description" minRows={2} value={editForm.description} onChange={(event) => onEditFormChange({ ...editForm, description: event.currentTarget.value })} />
          </Stack>
        </Paper>
        </WorkbenchAdvancedSection>
      ) : null}

      <WorkbenchAdvancedSection
        title="File versions"
        description="Attach or replace the current file and review version history when needed."
      >
      <form onSubmit={onSubmit}>
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={5}>Attach File</Title>
            <Button leftSection={<IconLink size={16} />} type="submit" loading={isAddingVersion} disabled={!form.fileName.trim() || (!form.externalUrl.trim() && !form.fileBase64.trim() && !(form.ingestSourceDownload && form.sourceDownloadUrl.trim()))}>
              Save File
            </Button>
          </Group>
          <Paper withBorder p="md">
            <Group justify="space-between" align="center">
              <Stack gap={2}>
                <Text fw={600}>Upload from computer</Text>
                <Text size="sm" c="dimmed">{form.fileBase64 ? form.fileName || 'File selected' : 'Choose a replacement file or add an external URL below.'}</Text>
              </Stack>
              <FileButton
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
              >
                {(props) => <Button {...props} variant="light" leftSection={<IconCloudUpload size={16} />}>Choose File</Button>}
              </FileButton>
            </Group>
          </Paper>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Paste file link"
              value={form.externalUrl}
              onChange={(event) => onFormChange({ ...form, externalUrl: event.currentTarget.value })}
            />
            <TextInput
              label="File name"
              value={form.fileName}
              onChange={(event) => onFormChange({ ...form, fileName: event.currentTarget.value })}
              required
            />
            <Checkbox
              mt="xl"
              label="Make current version"
              checked={form.makeCurrent}
              onChange={(event) => onFormChange({ ...form, makeCurrent: event.currentTarget.checked })}
            />
          </SimpleGrid>
          <WorkbenchAdvancedSection
            title="Advanced file source details"
            description="Use when preserving source IDs or copying a source URL into managed storage."
          >
            <SimpleGrid cols={{ base: 1, sm: 2 }} mt="sm">
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
            </SimpleGrid>
          </WorkbenchAdvancedSection>
        </Stack>
      </form>

        <WorkbenchTable<DigitalAssetVersionRow>
          ariaLabel="Asset file history"
          rows={asset.versions}
          getRowKey={(version) => version.id}
          minWidth={680}
          columns={[
            {
              key: 'version',
              header: 'Version',
              render: (version) => <Badge color={version.isCurrent ? 'green' : 'gray'}>v{version.versionNumber}</Badge>,
              width: 110,
            },
            {
              key: 'file',
              header: 'File',
              render: (version) => (
                <Stack gap={2}>
                  <Text fw={600} size="sm">{version.fileName}</Text>
                  <Text c="dimmed" size="xs">{version.mimeType ?? 'Unknown type'}</Text>
                </Stack>
              ),
            },
            {
              key: 'delivery',
              header: 'Delivery',
              render: (version) => (
                <Text size="xs" c="dimmed">
                  {version.publicUrl || version.externalUrl ? 'Link available' : version.storageKey ? 'Managed storage' : 'No delivery location'}
                </Text>
              ),
            },
            {
              key: 'created',
              header: 'Created',
              render: (version) => formatDate(version.createdAt),
            },
          ]}
          emptyState={(
            <EmptyStateMessage
              kind="no-data"
              title="No versions attached yet"
              description="Upload a file or paste a managed file link to create the first version."
            />
          )}
        />
      </WorkbenchAdvancedSection>

      {(asset.legacyUrl || asset.legacyMetadataFields?.length || asset.migrationIssues?.length || asset.legacyMetadata) ? (
        <WorkbenchAdvancedSection
          title="Source and migration trace"
          description="Legacy Widen links, source metadata, and import issues stay available for audit after the daily asset tasks."
        >
          <Stack gap="md">
            {asset.legacyUrl ? (
              <Text component="a" href={asset.legacyUrl} target="_blank" rel="noreferrer" size="sm" c="blue">
                Original Widen link
              </Text>
            ) : null}
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
        </WorkbenchAdvancedSection>
      ) : null}
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

function AssetShareStep({
  detail,
  label,
  tone,
  value,
}: {
  detail: string;
  label: string;
  tone: 'ready' | 'attention';
  value: string;
}) {
  return (
    <Paper withBorder p="sm">
      <Stack gap={4}>
        <Group justify="space-between" align="flex-start">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">{label}</Text>
          <Badge color={tone === 'ready' ? 'green' : 'yellow'} variant="light">{value}</Badge>
        </Group>
        <Text size="xs" c="dimmed">{detail}</Text>
      </Stack>
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
