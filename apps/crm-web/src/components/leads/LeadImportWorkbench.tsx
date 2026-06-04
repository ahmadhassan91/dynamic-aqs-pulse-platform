'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  NumberFormatter,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconFileUpload, IconRefresh, IconUpload } from '@tabler/icons-react';
import type {
  LeadImportRunDetail,
  ImportLeadFileResponse,
  LeadImportColumnMapping,
  LeadImportDuplicateCandidate,
  LeadImportDuplicateDecisionKey,
  LeadImportFilePreviewResponse,
  LeadImportReviewRow,
  LeadImportTargetFieldKey,
  LeadRoutingPolicySummary,
  ReferenceValueSummary,
  ReviewLeadImportResponse,
} from '@pulse/contracts';
import {
  commitLeadImportRun,
  fetchBusinessSegments,
  fetchLeadRoutingPolicy,
  fetchLeadSources,
  previewLeadImport,
  reviewLeadImport,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

type ImportContextState = {
  batchName: string;
  businessSegmentCode: string;
  leadSourceCode: string;
  sourceSiteId: string;
  sourceSiteName: string;
  sourceBrandTag: string;
};

const EMPTY_IMPORT_CONTEXT: ImportContextState = {
  batchName: '',
  businessSegmentCode: '',
  leadSourceCode: '',
  sourceSiteId: '',
  sourceSiteName: '',
  sourceBrandTag: '',
};

export function LeadImportWorkbench() {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [businessSegments, setBusinessSegments] = useState<ReferenceValueSummary[]>([]);
  const [leadSources, setLeadSources] = useState<ReferenceValueSummary[]>([]);
  const [routingPolicy, setRoutingPolicy] = useState<LeadRoutingPolicySummary | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileContentBase64, setFileContentBase64] = useState<string | null>(null);
  const [preview, setPreview] = useState<LeadImportFilePreviewResponse | null>(null);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [mappings, setMappings] = useState<Record<string, LeadImportTargetFieldKey | ''>>({});
  const [importContext, setImportContext] = useState<ImportContextState>(EMPTY_IMPORT_CONTEXT);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<ReviewLeadImportResponse | LeadImportRunDetail | null>(null);
  const [importResult, setImportResult] = useState<ImportLeadFileResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [rowDecisions, setRowDecisions] = useState<Record<number, { duplicateDecision: LeadImportDuplicateDecisionKey | ''; targetEntityId: string }>>({});

  useEffect(() => {
    if (!auth) {
      setBusinessSegments([]);
      setLeadSources([]);
      setRoutingPolicy(null);
      return;
    }

    const accessToken = auth.tokens.accessToken;
    let cancelled = false;

    async function loadReferences() {
      setReferenceError(null);

      try {
        const [segmentResponse, sourceResponse, routingPolicyResponse] = await Promise.all([
          fetchBusinessSegments(apiBaseUrl, accessToken),
          fetchLeadSources(apiBaseUrl, accessToken),
          fetchLeadRoutingPolicy(apiBaseUrl, accessToken),
        ]);

        if (cancelled) {
          return;
        }

        setBusinessSegments(segmentResponse.items);
        setLeadSources(sourceResponse.items);
        setRoutingPolicy(routingPolicyResponse);
        setImportContext((current) => ({
          ...current,
          businessSegmentCode: current.businessSegmentCode || chooseDefaultBusinessSegment(segmentResponse.items),
          leadSourceCode: current.leadSourceCode || chooseDefaultLeadSource(sourceResponse.items),
        }));
      } catch (error) {
        if (!cancelled) {
          setReferenceError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void loadReferences();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth]);

  const mappedColumnCount = useMemo(
    () => Object.values(mappings).filter((value) => value.length > 0).length,
    [mappings],
  );

  useEffect(() => {
    setReviewResult(null);
    setReviewError(null);
    setImportResult(null);
    setImportError(null);
  }, [mappings, importContext, selectedSheet]);

  const requiredFieldsMissing = useMemo(() => {
    const mappedFields = new Set(
      Object.values(mappings).filter((value): value is LeadImportTargetFieldKey => value.length > 0),
    );
    const missing: string[] = [];

    if (!mappedFields.has('companyName')) {
      missing.push('Company Name');
    }
    if (!mappedFields.has('serviceTechCount')) {
      missing.push('Service Tech Count');
    }

    return missing;
  }, [mappings]);

  const currentStep = preview
    ? importResult
      ? 3
      : 2
    : file
      ? 1
      : 0;

  async function handleFileSelected(selectedFile: File | null) {
    setFile(selectedFile);
    setPreview(null);
    setReviewResult(null);
    setImportResult(null);
    setPreviewError(null);
    setReviewError(null);
    setImportError(null);
    setMappings({});
    setRowDecisions({});
    setSelectedSheet('');

    if (!selectedFile) {
      setFileContentBase64(null);
      return;
    }

    try {
      const base64 = await encodeFileToBase64(selectedFile);
      setFileContentBase64(base64);
      await requestPreview(selectedFile, base64);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : String(error));
    }
  }

  async function requestPreview(selectedFile: File, base64: string, sheetName?: string) {
    if (!auth) {
      return;
    }

    const accessToken = auth.tokens.accessToken;
    setIsPreviewLoading(true);
    setPreviewError(null);

    try {
      const response = await previewLeadImport(apiBaseUrl, accessToken, {
        fileName: selectedFile.name,
        fileContentBase64: base64,
        ...(sheetName ? { sheetName } : {}),
      });

      setPreview(response);
      setReviewResult(null);
      setSelectedSheet(response.sheetName);
      setReviewError(null);
      setRowDecisions({});
      setMappings(
        Object.fromEntries(
          response.columns.map((column) => [column.sourceHeader, column.suggestedTargetField ?? '']),
        ) as Record<string, LeadImportTargetFieldKey | ''>,
      );
    } catch (error) {
      setPreview(null);
      setPreviewError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleSheetChange(nextSheet: string | null) {
    setSelectedSheet(nextSheet ?? '');
    if (!file || !fileContentBase64 || !nextSheet) {
      return;
    }

    await requestPreview(file, fileContentBase64, nextSheet);
  }

  async function handleImportSubmit() {
    if (!auth || !reviewResult) {
      return;
    }

    const accessToken = auth.tokens.accessToken;
    setImportError(null);
    setImportResult(null);
    setIsImporting(true);

    try {
      const response = await commitLeadImportRun(apiBaseUrl, accessToken, reviewResult.runId, {
        rowDecisions: reviewResult.rows
          .filter((row: LeadImportReviewRow) => row.status === 'potential_duplicate')
          .map((row: LeadImportReviewRow) => {
            const decision = rowDecisions[row.rowNumber];

            return {
              rowNumber: row.rowNumber,
              duplicateDecision: (decision?.duplicateDecision || 'create_new') as LeadImportDuplicateDecisionKey,
              ...(decision?.targetEntityId ? { targetEntityId: decision.targetEntityId } : {}),
            };
          }),
      });

      setImportResult(response);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsImporting(false);
    }
  }

  async function handleRunReview() {
    if (!auth || !file || !fileContentBase64 || !preview) {
      return;
    }

    const accessToken = auth.tokens.accessToken;
    setReviewError(null);
    setReviewResult(null);
    setIsReviewLoading(true);

    try {
      const payloadMappings: LeadImportColumnMapping[] = preview.columns.map((column) => {
        const selectedTarget = mappings[column.sourceHeader];

        return {
          sourceHeader: column.sourceHeader,
          ...(selectedTarget ? { targetField: selectedTarget } : {}),
        };
      });

      const response = await reviewLeadImport(apiBaseUrl, accessToken, {
        fileName: file.name,
        fileContentBase64,
        ...(selectedSheet ? { sheetName: selectedSheet } : {}),
        ...(importContext.batchName.trim() ? { batchName: importContext.batchName.trim() } : {}),
        ...(importContext.businessSegmentCode ? { businessSegmentCode: importContext.businessSegmentCode } : {}),
        ...(importContext.leadSourceCode ? { leadSourceCode: importContext.leadSourceCode } : {}),
        ...(importContext.sourceSiteId.trim() ? { sourceSiteId: importContext.sourceSiteId.trim() } : {}),
        ...(importContext.sourceSiteName.trim() ? { sourceSiteName: importContext.sourceSiteName.trim() } : {}),
        ...(importContext.sourceBrandTag.trim() ? { sourceBrandTag: importContext.sourceBrandTag.trim() } : {}),
        mappings: payloadMappings,
      });

      setReviewResult(response);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsReviewLoading(false);
    }
  }

  const unresolvedDuplicateRows = useMemo(
    () =>
      (reviewResult?.rows ?? []).filter((reviewRow: LeadImportReviewRow) => {
        if (reviewRow.status !== 'potential_duplicate') {
          return false;
        }

        const decision = rowDecisions[reviewRow.rowNumber];
        if (!decision?.duplicateDecision) {
          return true;
        }
        const persistedCandidates = reviewRow.candidates.filter((candidate) => candidate.entityType !== 'import_row');
        if (decision.duplicateDecision === 'use_existing' && persistedCandidates.length > 1 && !decision.targetEntityId) {
          return true;
        }

        return false;
      }).length,
    [reviewResult, rowDecisions],
  );

  if (!isHydrated || !auth) {
    return null;
  }

  return (
    <Stack gap="lg">
      <Paper shadow="sm" p="lg" radius="xl" className="premium-hero-panel">
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs">
            <Title order={1}>Lead Import Workbench</Title>
            <Text size="sm" c="dimmed">
              This preserves the approved import rhythm while using the live preview, mapping, and governed import APIs underneath.
            </Text>
            <Group gap="xs">
              <Badge color="blue" variant="light">CSV + XLSX</Badge>
              <Badge color="cyan" variant="light">Header Mapping</Badge>
              <Badge color="grape" variant="light">Live Backend Import</Badge>
            </Group>
          </Stack>
          <Group gap="sm">
            <Button component={Link} href="/leads" variant="default">
              Open Lead Work Queue
            </Button>
            <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={() => file && fileContentBase64 ? void requestPreview(file, fileContentBase64, selectedSheet || undefined) : undefined} disabled={!file || !fileContentBase64 || isPreviewLoading}>
              Refresh Preview
            </Button>
          </Group>
        </Group>
      </Paper>

      {referenceError ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />} className="premium-subhero-panel">
          {referenceError}
        </Alert>
      ) : null}

      <Paper withBorder p="md" radius="xl" className="premium-subhero-panel">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={4}>
            <Text fw={600}>Import defaults and routing context</Text>
            <Text size="sm" c="dimmed">
              Current routing policy uses <strong>{formatRoutingBasis(routingPolicy?.routingBasis)}</strong> with Strategic Growth up to <strong>{routingPolicy?.strategicGrowthMax ?? 5}</strong> and National TM from <strong>{routingPolicy?.nationalTmMin ?? 6}</strong>.
            </Text>
          </Stack>
          <Group gap="xs">
            <Badge color="blue" variant="light">{auth.identity.displayName ?? auth.identity.email ?? auth.identity.userId}</Badge>
            <Badge color="gray" variant="outline">{auth.identity.role}</Badge>
          </Group>
        </Group>
      </Paper>

      <Stepper active={currentStep} allowNextStepsSelect={Boolean(preview)}>
        <Stepper.Step label="Upload" description="Select file">
          <Card withBorder radius="xl" p="lg" className="premium-stat-card">
            <Stack gap="md">
              <FileInput
                label="Lead file"
                placeholder="Choose CSV or XLSX"
                accept=".csv,.tsv,.xlsx,.xls"
                leftSection={<IconFileUpload size={16} />}
                value={file}
                onChange={(selectedFile) => {
                  void handleFileSelected(selectedFile);
                }}
              />
              <Text size="sm" c="dimmed">
                Supported formats: CSV, TSV, XLS, XLSX. Preview is API-backed so the mapping screen reflects the real parser that will be used on import.
              </Text>
              {previewError ? (
                <Alert color="red" icon={<IconAlertCircle size={16} />}>
                  {previewError}
                </Alert>
              ) : null}
            </Stack>
          </Card>
        </Stepper.Step>

        <Stepper.Step label="Map" description="Confirm headers">
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
              <Card withBorder radius="xl" p="md" className="premium-stat-card">
                <Text size="sm" c="dimmed">Rows detected</Text>
                <Title order={3}>{preview?.totalRows ?? 0}</Title>
              </Card>
              <Card withBorder radius="xl" p="md" className="premium-stat-card">
                <Text size="sm" c="dimmed">Source headers</Text>
                <Title order={3}>{preview?.columns.length ?? 0}</Title>
              </Card>
              <Card withBorder radius="xl" p="md" className="premium-stat-card">
                <Text size="sm" c="dimmed">Mapped columns</Text>
                <Title order={3}>{mappedColumnCount}</Title>
              </Card>
              <Card withBorder radius="xl" p="md" className="premium-stat-card">
                <Text size="sm" c="dimmed">Workbook sheets</Text>
                <Title order={3}>{preview?.availableSheets.length ?? 0}</Title>
              </Card>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Card withBorder radius="xl" p="lg" className="premium-action-card">
                <Stack gap="md">
                  <Title order={4}>Import context</Title>
                  <TextInput
                    label="Batch name"
                    value={importContext.batchName}
                    onChange={(event) => setImportContext((current) => ({ ...current, batchName: event.currentTarget.value }))}
                    placeholder="Trade Show - Dallas - Apr 2026"
                  />
                  <Select
                    label="Lead source"
                    value={importContext.leadSourceCode}
                    onChange={(value) => setImportContext((current) => ({ ...current, leadSourceCode: value ?? '' }))}
                    data={leadSources.map((item) => ({
                      value: item.code,
                      label: `${item.name} (${item.code})`,
                    }))}
                    searchable
                  />
                  <Select
                    label="Business segment"
                    value={importContext.businessSegmentCode}
                    onChange={(value) => setImportContext((current) => ({ ...current, businessSegmentCode: value ?? '' }))}
                    data={businessSegments.map((item) => ({
                      value: item.code,
                      label: `${item.name} (${item.code})`,
                    }))}
                    searchable
                  />
                  <TextInput
                    label="Source site ID"
                    value={importContext.sourceSiteId}
                    onChange={(event) => setImportContext((current) => ({ ...current, sourceSiteId: event.currentTarget.value }))}
                  />
                  <TextInput
                    label="Source site name"
                    value={importContext.sourceSiteName}
                    onChange={(event) => setImportContext((current) => ({ ...current, sourceSiteName: event.currentTarget.value }))}
                  />
                  <TextInput
                    label="Source brand tag"
                    value={importContext.sourceBrandTag}
                    onChange={(event) => setImportContext((current) => ({ ...current, sourceBrandTag: event.currentTarget.value }))}
                  />
                </Stack>
              </Card>

              <Card withBorder radius="xl" p="lg" className="premium-action-card">
                <Stack gap="md">
                  <Title order={4}>Workbook preview</Title>
                  <Select
                    label="Sheet"
                    value={selectedSheet}
                    onChange={(value) => {
                      void handleSheetChange(value);
                    }}
                    data={(preview?.availableSheets ?? []).map((sheet) => ({ value: sheet, label: sheet }))}
                    disabled={!preview || (preview.availableSheets.length <= 1)}
                  />
                  {requiredFieldsMissing.length > 0 ? (
                    <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                      Required mappings still missing: {requiredFieldsMissing.join(', ')}.
                    </Alert>
                  ) : (
                    <Alert color="green" icon={<IconCheck size={16} />}>
                      Required lead columns are mapped and ready for governed import.
                    </Alert>
                  )}
                  <Text size="sm" c="dimmed">
                    Keep `Company Name` and `Service Tech Count` mapped. Everything else can be filled per-file or later in the pipeline.
                  </Text>
                </Stack>
              </Card>
            </SimpleGrid>

            {preview ? (
              <>
                <Paper withBorder radius="xl" p="sm" className="premium-subhero-panel">
                  <Table.ScrollContainer minWidth={860}>
                    <Table highlightOnHover verticalSpacing="sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Source header</Table.Th>
                          <Table.Th>Sample value</Table.Th>
                          <Table.Th>Target field</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {preview.columns.map((column) => (
                          <Table.Tr key={column.sourceHeader}>
                            <Table.Td fw={600}>{column.sourceHeader}</Table.Td>
                            <Table.Td c="dimmed">{column.sampleValue ?? '—'}</Table.Td>
                            <Table.Td>
                              <Select
                                value={mappings[column.sourceHeader] ?? ''}
                                onChange={(value) =>
                                  setMappings((current) => ({
                                    ...current,
                                    [column.sourceHeader]: (value as LeadImportTargetFieldKey | '') ?? '',
                                  }))
                                }
                                data={[
                                  { value: '', label: 'Skip this column' },
                                  ...preview.targetFieldOptions.map((option) => ({
                                    value: option.value,
                                    label: option.label,
                                  })),
                                ]}
                                searchable
                                clearable={false}
                              />
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Paper>

                <Paper withBorder radius="xl" p="sm" className="premium-subhero-panel">
                  <Table.ScrollContainer minWidth={860}>
                    <Table verticalSpacing="sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Preview row</Table.Th>
                          {preview.columns.map((column) => (
                            <Table.Th key={column.sourceHeader}>{column.sourceHeader}</Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {preview.previewRows.map((row) => (
                          <Table.Tr key={row.rowNumber}>
                            <Table.Td>#{row.rowNumber}</Table.Td>
                            {preview.columns.map((column) => (
                              <Table.Td key={`${row.rowNumber}:${column.sourceHeader}`}>{row.values[column.sourceHeader] || '—'}</Table.Td>
                            ))}
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Paper>
              </>
            ) : null}
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Import" description="Create leads">
          <Card withBorder radius="xl" p="lg" className="premium-action-card">
            <Stack gap="md">
              <Text c="dimmed" size="sm">
                Review duplicate and invalid rows before sending the mapped leads into the governed import pipeline.
              </Text>
              <Group>
                <Button
                  variant="light"
                  leftSection={<IconRefresh size={16} />}
                  onClick={() => {
                    void handleRunReview();
                  }}
                  loading={isReviewLoading}
                  disabled={!preview || requiredFieldsMissing.length > 0 || mappedColumnCount === 0}
                >
                  Analyze import rows
                </Button>
              </Group>
              {reviewError ? (
                <Alert color="red" icon={<IconAlertCircle size={16} />}>
                  {reviewError}
                </Alert>
              ) : null}
              {reviewResult ? (
                <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
                  <Card withBorder radius="xl" p="md" className="premium-stat-card">
                    <Text size="sm" c="dimmed">Rows mapped</Text>
                    <Title order={3}>{reviewResult.mappedRows}</Title>
                  </Card>
                  <Card withBorder radius="xl" p="md" className="premium-stat-card">
                    <Text size="sm" c="dimmed">Rows ready</Text>
                    <Title order={3}>{reviewResult.readyRowCount}</Title>
                  </Card>
                  <Card withBorder radius="xl" p="md" className="premium-stat-card">
                    <Text size="sm" c="dimmed">Attention required</Text>
                    <Title order={3}>{reviewResult.attentionRowCount}</Title>
                  </Card>
                  <Card withBorder radius="xl" p="md" className="premium-stat-card">
                    <Text size="sm" c="dimmed">Unresolved duplicates</Text>
                    <Title order={3}>{unresolvedDuplicateRows}</Title>
                  </Card>
                </SimpleGrid>
              ) : null}
              {reviewResult?.rows.length ? (
                <Paper withBorder radius="xl" p="lg" className="premium-subhero-panel">
                  <Stack gap="md">
                    <Title order={4}>Rows requiring attention</Title>
                    {reviewResult.rows.map((row: LeadImportReviewRow) => (
                      <Card key={row.rowNumber} withBorder radius="lg" p="md">
                        <Stack gap="sm">
                          <Group justify="space-between" align="flex-start">
                            <Stack gap={2}>
                              <Text fw={600}>Row {row.rowNumber}</Text>
                              <Text size="sm" c="dimmed">{row.detail}</Text>
                            </Stack>
                            <Badge color={row.status === 'invalid' ? 'red' : 'yellow'} variant="light">
                              {row.status === 'invalid' ? 'Invalid Row' : 'Potential Duplicate'}
                            </Badge>
                          </Group>
                          {row.candidates.length ? (
                            <Stack gap="xs">
                              {row.candidates.map((candidate: LeadImportDuplicateCandidate) => (
                                <Paper key={candidate.entityId} withBorder radius="md" p="sm">
                                  <Text fw={600}>{candidate.title}</Text>
                                  {candidate.subtitle ? <Text size="sm" c="dimmed">{candidate.subtitle}</Text> : null}
                                  {candidate.detail ? <Text size="sm" c="dimmed">{candidate.detail}</Text> : null}
                                </Paper>
                              ))}
                              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                                <Select
                                  label="Import decision"
                                  value={rowDecisions[row.rowNumber]?.duplicateDecision ?? ''}
                                  onChange={(value) =>
                                    setRowDecisions((current) => ({
                                      ...current,
                                      [row.rowNumber]: {
                                        duplicateDecision: ((value as LeadImportDuplicateDecisionKey | '') ?? ''),
                                        targetEntityId: current[row.rowNumber]?.targetEntityId ?? '',
                                      },
                                    }))
                                  }
                                  data={[
                                    { value: '', label: 'Select a decision' },
                                    { value: 'create_new', label: 'Create a new lead anyway' },
                                    ...(row.candidates.some((candidate) => candidate.entityType !== 'import_row')
                                      ? [{ value: 'use_existing', label: 'Use existing record and skip this row' }]
                                      : []),
                                    { value: 'skip', label: 'Skip this row' },
                                  ]}
                                  clearable={false}
                                />
                                <Select
                                  label="Existing record"
                                  value={rowDecisions[row.rowNumber]?.targetEntityId ?? ''}
                                  onChange={(value) =>
                                    setRowDecisions((current) => ({
                                      ...current,
                                      [row.rowNumber]: {
                                        duplicateDecision: current[row.rowNumber]?.duplicateDecision ?? '',
                                        targetEntityId: value ?? '',
                                      },
                                    }))
                                  }
                                  data={row.candidates
                                    .filter((candidate) => candidate.entityType !== 'import_row')
                                    .map((candidate: LeadImportDuplicateCandidate) => ({
                                      value: candidate.entityId,
                                      label: `${candidate.title} (${candidate.entityType})`,
                                    }))}
                                  disabled={(rowDecisions[row.rowNumber]?.duplicateDecision ?? '') !== 'use_existing'}
                                  placeholder={row.candidates.filter((candidate) => candidate.entityType !== 'import_row').length > 1 ? 'Select the existing record' : 'Optional for single candidate'}
                                  clearable={row.candidates.filter((candidate) => candidate.entityType !== 'import_row').length > 1}
                                />
                              </SimpleGrid>
                            </Stack>
                          ) : null}
                        </Stack>
                      </Card>
                    ))}
                  </Stack>
                </Paper>
              ) : reviewResult ? (
                <Alert color="green" icon={<IconCheck size={16} />}>
                  All mapped rows are ready for import. No duplicate or validation review is required.
                </Alert>
              ) : null}
              <Group>
                <Button
                  leftSection={<IconUpload size={16} />}
                  onClick={() => {
                    void handleImportSubmit();
                  }}
                  loading={isImporting}
                  disabled={!preview || !reviewResult || requiredFieldsMissing.length > 0 || mappedColumnCount === 0 || unresolvedDuplicateRows > 0}
                >
                  Import {preview?.totalRows ?? 0} lead{preview?.totalRows === 1 ? '' : 's'}
                </Button>
              </Group>
              {importError ? (
                <Alert color="red" icon={<IconAlertCircle size={16} />}>
                  {importError}
                </Alert>
              ) : null}
            </Stack>
          </Card>
        </Stepper.Step>

        <Stepper.Completed>
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
              <Card withBorder radius="xl" p="md" className="premium-stat-card">
                <Text size="sm" c="dimmed">Rows detected</Text>
                <Title order={3}><NumberFormatter value={importResult?.totalRows ?? 0} thousandSeparator /></Title>
              </Card>
              <Card withBorder radius="xl" p="md" className="premium-stat-card">
                <Text size="sm" c="dimmed">Rows mapped</Text>
                <Title order={3}>{importResult?.mappedRows ?? 0}</Title>
              </Card>
              <Card withBorder radius="xl" p="md" className="premium-stat-card">
                <Text size="sm" c="dimmed">Leads created</Text>
                <Title order={3}>{importResult?.createdCount ?? 0}</Title>
              </Card>
              <Card withBorder radius="xl" p="md" className="premium-stat-card">
                <Text size="sm" c="dimmed">Rows with issues</Text>
                <Title order={3}>{importResult?.errorCount ?? 0}</Title>
              </Card>
              <Card withBorder radius="xl" p="md" className="premium-stat-card">
                <Text size="sm" c="dimmed">Rows skipped</Text>
                <Title order={3}>{importResult?.skippedCount ?? 0}</Title>
              </Card>
            </SimpleGrid>

            {importResult && importResult.createdCount === 0 ? (
              <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                No new leads were created from this import run. Review skipped rows and row issues before rerunning another batch.
              </Alert>
            ) : null}

            {importResult?.items.length ? (
              <Paper withBorder radius="xl" p="lg" className="premium-subhero-panel">
                <Stack gap="sm">
                  <Title order={4}>Created leads</Title>
                  {importResult.items.slice(0, 8).map((item) => (
                    <Text key={item.id}>
                      <Text component={Link} href={`/leads/${item.id}`} fw={600}>
                        {item.companyName}
                      </Text>{' '}
                      · {item.contactDisplayName} · {item.routingTeam} · {item.stage}
                    </Text>
                  ))}
                  <Group>
                    <Button component={Link} href={importResult.items[0] ? `/leads/${importResult.items[0].id}` : '/leads'}>
                      Open Lead Workspace
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            ) : null}

            {importResult?.skippedRows.length ? (
              <Paper withBorder radius="xl" p="lg" className="premium-subhero-panel">
                <Stack gap="sm">
                  <Title order={4}>Skipped rows</Title>
                  {importResult.skippedRows.map((row) => (
                    <Text key={`${row.rowNumber}:${row.detail}`}>
                      <strong>Row {row.rowNumber}:</strong> {row.detail}
                    </Text>
                  ))}
                </Stack>
              </Paper>
            ) : null}

            {importResult?.errors.length ? (
              <Paper withBorder radius="xl" p="lg" className="premium-subhero-panel">
                <Stack gap="sm">
                  <Title order={4}>Row issues</Title>
                  {importResult.errors.map((error) => (
                    <Text key={`${error.rowNumber}:${error.detail}`}>
                      <strong>Row {error.rowNumber}:</strong> {error.detail}
                    </Text>
                  ))}
                </Stack>
              </Paper>
            ) : null}
          </Stack>
        </Stepper.Completed>
      </Stepper>
    </Stack>
  );
}

function chooseDefaultBusinessSegment(items: ReferenceValueSummary[]) {
  return items.find((item) => item.code === 'residential')?.code ?? items[0]?.code ?? '';
}

function chooseDefaultLeadSource(items: ReferenceValueSummary[]) {
  return items.find((item) => item.code === 'manual_entry')?.code ?? items[0]?.code ?? '';
}

function formatRoutingBasis(value: LeadRoutingPolicySummary['routingBasis'] | undefined) {
  return value === 'truck_count' ? 'Truck Count' : 'Service Tech Count';
}

async function encodeFileToBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary);
}
