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
import { IconAlertTriangle, IconCloudUpload, IconHistory, IconLink, IconPhoto, IconPlus, IconSearch } from '@tabler/icons-react';
import {
  DIGITAL_ASSET_KINDS,
  DIGITAL_ASSET_VISIBILITIES,
  type DigitalAssetDetail,
  type DigitalAssetKindKey,
  type DigitalAssetVisibilityKey,
} from '@pulse/contracts/digital-assets';
import {
  createDigitalAssetRecord,
  createDigitalAssetVersionRecord,
  fetchDigitalAssetDetail,
  fetchDigitalAssetLibrary,
  fetchWidenImportRuns,
  previewWidenImport,
  type ListDigitalAssetsResponse,
  type ListWidenImportRunsResponse,
  type WidenImportPreviewResponse,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

type AssetTab = 'library' | 'migration';

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

export function DigitalAssetsWorkspace() {
  const { apiBaseUrl, auth } = usePulseSession();
  const [activeTab, setActiveTab] = useState<AssetTab>('library');
  const [search, setSearch] = useState('');
  const [assets, setAssets] = useState<ListDigitalAssetsResponse>({ items: [], total: 0 });
  const [selectedAsset, setSelectedAsset] = useState<DigitalAssetDetail | null>(null);
  const [assetForm, setAssetForm] = useState<CreateAssetFormState>(defaultAssetForm);
  const [versionForm, setVersionForm] = useState<VersionFormState>(defaultVersionForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isCreatingAsset, setIsCreatingAsset] = useState(false);
  const [isAddingVersion, setIsAddingVersion] = useState(false);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<WidenImportPreviewResponse | null>(null);
  const [importRuns, setImportRuns] = useState<ListWidenImportRunsResponse>({ items: [] });

  const kindOptions = useMemo(() => DIGITAL_ASSET_KINDS.map((kind) => ({ value: kind, label: formatLabel(kind) })), []);
  const visibilityOptions = useMemo(() => DIGITAL_ASSET_VISIBILITIES.map((visibility) => ({ value: visibility, label: formatLabel(visibility) })), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as AssetTab | null;
    if (tab && ['library', 'migration'].includes(tab)) {
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
        const response = await fetchDigitalAssetLibrary(apiBaseUrl, auth.tokens.accessToken, { search, limit: 100 });
        if (!cancelled) setAssets(response);
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
    const response = await fetchDigitalAssetLibrary(apiBaseUrl, auth.tokens.accessToken, { search, limit: 100 });
    setAssets(response);
  };

  const loadAssetDetail = async (assetId: string) => {
    if (!auth) return;
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const response = await fetchDigitalAssetDetail(apiBaseUrl, auth.tokens.accessToken, assetId);
      setSelectedAsset(response);
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
                    form={versionForm}
                    isAddingVersion={isAddingVersion}
                    onFormChange={setVersionForm}
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
  form,
  isAddingVersion,
  onFormChange,
  onSubmit,
}: {
  asset: DigitalAssetDetail;
  form: VersionFormState;
  isAddingVersion: boolean;
  onFormChange: (form: VersionFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
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
      {asset.legacyUrl ? (
        <Text component="a" href={asset.legacyUrl} target="_blank" rel="noreferrer" size="sm" c="blue">
          {asset.legacyUrl}
        </Text>
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

function formatLabel(value: string) {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}
