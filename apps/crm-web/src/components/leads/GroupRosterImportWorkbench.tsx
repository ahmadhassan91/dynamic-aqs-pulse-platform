'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  FileInput,
  Group,
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
import { IconCheck, IconFileUpload, IconRefresh, IconUsers } from '@tabler/icons-react';
import type {
  AffinityGroupReferenceSummary,
  GroupRosterImportColumnMapping,
  GroupRosterImportReviewRow,
  GroupRosterImportTargetFieldKey,
  GroupRosterImportFilePreviewResponse,
  GroupRosterImportRunDetail,
  GroupRosterMatchCandidate,
  OwnershipGroupReferenceSummary,
  ReviewGroupRosterImportResponse,
} from '@pulse/contracts';
import {
  commitGroupRosterImportRun,
  previewGroupRosterImport,
  reviewGroupRosterImport,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

type GroupRosterImportWorkbenchProps = {
  affinityGroups: AffinityGroupReferenceSummary[];
  ownershipGroups: OwnershipGroupReferenceSummary[];
  canManage: boolean;
};

type ReviewDecisionState = {
  action: 'apply' | 'skip' | '';
  targetEntityId: string;
};

export function GroupRosterImportWorkbench({
  affinityGroups,
  ownershipGroups,
  canManage,
}: GroupRosterImportWorkbenchProps) {
  const { apiBaseUrl, auth } = usePulseSession();
  const [groupKind, setGroupKind] = useState<'affinity' | 'ownership'>('affinity');
  const [groupId, setGroupId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileContentBase64, setFileContentBase64] = useState<string | null>(null);
  const [preview, setPreview] = useState<GroupRosterImportFilePreviewResponse | null>(null);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [mappings, setMappings] = useState<Record<string, GroupRosterImportTargetFieldKey | ''>>({});
  const [batchName, setBatchName] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [sourceVersion, setSourceVersion] = useState('');
  const [reviewResult, setReviewResult] = useState<ReviewGroupRosterImportResponse | GroupRosterImportRunDetail | null>(null);
  const [decisions, setDecisions] = useState<Record<number, ReviewDecisionState>>({});
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  const groupOptions = useMemo(
    () => (groupKind === 'affinity' ? affinityGroups : ownershipGroups)
      .filter((item) => item.isActive)
      .map((item) => ({
        value: item.id,
        label: `${item.name} (${item.code})`,
      })),
    [affinityGroups, groupKind, ownershipGroups],
  );

  useEffect(() => {
    if (!groupOptions.some((option) => option.value === groupId)) {
      setGroupId(groupOptions[0]?.value ?? '');
    }
  }, [groupOptions, groupId]);

  useEffect(() => {
    setPreview(null);
    setReviewResult(null);
    setPreviewError(null);
    setReviewError(null);
    setCommitError(null);
    setSuccessMessage(null);
    setMappings({});
    setDecisions({});
  }, [groupKind, groupId]);

  const requiredFieldsMissing = useMemo(() => {
    const mappedFields = new Set(
      Object.values(mappings).filter((value): value is GroupRosterImportTargetFieldKey => value.length > 0),
    );
    const missing: string[] = [];

    if (!mappedFields.has('companyName') && !mappedFields.has('email') && !mappedFields.has('phone')) {
      missing.push('one of Company Name, Email, or Phone');
    }

    return missing;
  }, [mappings]);

  const currentStep = preview
    ? reviewResult
      ? 2
      : 1
    : file
      ? 0
      : 0;

  async function handleFileSelected(selectedFile: File | null) {
    setFile(selectedFile);
    setPreview(null);
    setReviewResult(null);
    setPreviewError(null);
    setReviewError(null);
    setCommitError(null);
    setSuccessMessage(null);
    setMappings({});
    setDecisions({});
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
    if (!groupId) {
      setPreviewError('Choose a governed target group before previewing the roster.');
      return;
    }

    setIsPreviewLoading(true);
    setPreviewError(null);

    try {
      const response = await previewGroupRosterImport(apiBaseUrl, auth.tokens.accessToken, {
        groupKind,
        groupId,
        fileName: selectedFile.name,
        fileContentBase64: base64,
        ...(sheetName ? { sheetName } : {}),
      });

      setPreview(response);
      setReviewResult(null);
      setSelectedSheet(response.sheetName);
      setMappings(
        Object.fromEntries(
          response.columns.map((column) => [column.sourceHeader, column.suggestedTargetField ?? '']),
        ) as Record<string, GroupRosterImportTargetFieldKey | ''>,
      );
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleRunReview() {
    if (!auth || !file || !fileContentBase64 || !preview || !groupId) {
      return;
    }

    setIsReviewLoading(true);
    setReviewError(null);
    setCommitError(null);
    setSuccessMessage(null);

    try {
      const payloadMappings: GroupRosterImportColumnMapping[] = preview.columns.map((column) => {
        const targetField = mappings[column.sourceHeader];
        return {
          sourceHeader: column.sourceHeader,
          ...(targetField ? { targetField } : {}),
        };
      });

      const response = await reviewGroupRosterImport(apiBaseUrl, auth.tokens.accessToken, {
        groupKind,
        groupId,
        fileName: file.name,
        fileContentBase64,
        ...(selectedSheet ? { sheetName: selectedSheet } : {}),
        ...(batchName.trim() ? { batchName: batchName.trim() } : {}),
        ...(sourceLabel.trim() ? { sourceLabel: sourceLabel.trim() } : {}),
        ...(sourceVersion.trim() ? { sourceVersion: sourceVersion.trim() } : {}),
        mappings: payloadMappings,
      });

      setReviewResult(response);
      setDecisions(
        Object.fromEntries(
          response.rows
            .filter((row) => row.status === 'requires_review')
            .map((row) => [row.rowNumber, { action: '', targetEntityId: '' }]),
        ),
      );
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsReviewLoading(false);
    }
  }

  async function handleCommit() {
    if (!auth || !reviewResult) {
      return;
    }

    setIsCommitting(true);
    setCommitError(null);

    try {
      const response = await commitGroupRosterImportRun(apiBaseUrl, auth.tokens.accessToken, reviewResult.runId, {
        rowDecisions: reviewResult.rows
          .filter((row) => row.status === 'requires_review')
          .map((row) => {
            const decision = decisions[row.rowNumber];
            if (!decision?.action) {
              return null;
            }

            return {
              rowNumber: row.rowNumber,
              action: decision.action,
              ...(decision.targetEntityId ? { targetEntityId: decision.targetEntityId } : {}),
            };
          })
          .filter((value): value is NonNullable<typeof value> => Boolean(value)),
      });

      setSuccessMessage(
        `Roster reconciliation applied ${response.appliedCount} row${response.appliedCount === 1 ? '' : 's'} and skipped ${response.skippedCount}.`,
      );
      setReviewResult(null);
    } catch (error) {
      setCommitError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCommitting(false);
    }
  }

  const blockingReviewRows = (reviewResult?.rows ?? []).filter((row) => row.status === 'requires_review');
  const reviewIncomplete = blockingReviewRows.some((row) => {
    const decision = decisions[row.rowNumber];
    if (!decision?.action) {
      return true;
    }

    if (decision.action === 'apply') {
      const persistedCandidates = row.candidates.filter((candidate) => candidate.entityType !== 'import_row');
      return persistedCandidates.length > 1 && !decision.targetEntityId;
    }

    return false;
  });

  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Title order={4}>Roster membership reconciliation</Title>
            <Text size="sm" c="dimmed">
              Load a periodic affinity or ownership roster, map the source columns, then review how each row should reconcile
              against existing leads and customer accounts.
            </Text>
          </Stack>
          <Badge variant="light" color="blue">
            CRM-owned classification slice
          </Badge>
        </Group>

        {!canManage ? (
          <Alert color="gray" variant="light">
            Your current role can review the classification masters, but only admins can run roster reconciliation.
          </Alert>
        ) : null}

        {successMessage ? (
          <Alert color="green" variant="light">{successMessage}</Alert>
        ) : null}

        <Stepper active={currentStep} allowNextStepsSelect={false}>
          <Stepper.Step label="Upload" description="Choose target group and file" />
          <Stepper.Step label="Map" description="Review columns and sample rows" />
          <Stepper.Step label="Reconcile" description="Match rows to records" />
        </Stepper>

        <SimpleGrid cols={{ base: 1, md: 3 }}>
          <Select
            label="Roster kind"
            data={[
              { value: 'affinity', label: 'Affinity roster' },
              { value: 'ownership', label: 'Ownership roster' },
            ]}
            value={groupKind}
            onChange={(value) => setGroupKind((value as 'affinity' | null) ?? 'ownership')}
            disabled={!canManage}
          />
          <Select
            label="Governed target group"
            data={groupOptions}
            value={groupId}
            onChange={(value) => setGroupId(value ?? '')}
            disabled={!canManage}
            searchable
          />
          <FileInput
            label="Roster file"
            placeholder="Upload CSV or XLSX"
            value={file}
            onChange={(value) => void handleFileSelected(value)}
            disabled={!canManage}
            accept=".csv,.xlsx"
            leftSection={<IconFileUpload size={16} />}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 3 }}>
          <Select
            label="Sheet"
            value={selectedSheet}
            data={preview?.availableSheets.map((value) => ({ value, label: value })) ?? []}
            onChange={(value) => {
              const nextSheet = value ?? '';
              setSelectedSheet(nextSheet);
              if (file && fileContentBase64 && nextSheet) {
                void requestPreview(file, fileContentBase64, nextSheet);
              }
            }}
            disabled={!preview || !canManage}
          />
          <TextInput
            label="Batch label"
            value={batchName}
            placeholder="Optional run label"
            onChange={(event) => setBatchName(event.currentTarget.value)}
            disabled={!canManage}
          />
          <TextInput
            label="Source label"
            value={sourceLabel}
            placeholder="Optional source label"
            onChange={(event) => setSourceLabel(event.currentTarget.value)}
            disabled={!canManage}
          />
        </SimpleGrid>

        <TextInput
          label="Source version"
          value={sourceVersion}
          placeholder="Optional roster version"
          onChange={(event) => setSourceVersion(event.currentTarget.value)}
          disabled={!canManage}
        />

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Alert color="blue" variant="light">
            A single run targets one governed group. Unmatched rows and conflict rows stay in steward review until you explicitly
            apply or skip them.
          </Alert>
          <Alert color="gray" variant="light">
            This slice intentionally does not create new leads from roster rows. Unmatched records stay review-visible instead of
            being auto-created.
          </Alert>
        </SimpleGrid>

        {previewError ? <Alert color="red">{previewError}</Alert> : null}
        {reviewError ? <Alert color="red">{reviewError}</Alert> : null}
        {commitError ? <Alert color="red">{commitError}</Alert> : null}

        {preview ? (
          <Stack gap="md">
            <Group justify="space-between">
              <Group gap="xs">
                <Badge variant="light" color="blue">{preview.totalRows} rows</Badge>
                <Badge variant="light" color="teal">{Object.values(mappings).filter(Boolean).length} mapped columns</Badge>
              </Group>
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => file && fileContentBase64 ? void requestPreview(file, fileContentBase64, selectedSheet || undefined) : undefined}
                loading={isPreviewLoading}
                disabled={!canManage}
              >
                Refresh Preview
              </Button>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              {preview.columns.map((column) => (
                <Select
                  key={column.sourceHeader}
                  label={column.sourceHeader}
                  description={column.sampleValue ? `Sample: ${column.sampleValue}` : 'No sample value'}
                  value={mappings[column.sourceHeader] ?? ''}
                  data={[
                    { value: '', label: 'Ignore column' },
                    ...preview.targetFieldOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    })),
                  ]}
                  onChange={(value) => setMappings((current) => ({
                    ...current,
                    [column.sourceHeader]: (value as GroupRosterImportTargetFieldKey | '') ?? '',
                  }))}
                  disabled={!canManage}
                />
              ))}
            </SimpleGrid>

            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <Title order={5}>Preview rows</Title>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Row</Table.Th>
                      {preview.columns.slice(0, 4).map((column) => (
                        <Table.Th key={column.sourceHeader}>{column.sourceHeader}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {preview.previewRows.map((row) => (
                      <Table.Tr key={row.rowNumber}>
                        <Table.Td>{row.rowNumber}</Table.Td>
                        {preview.columns.slice(0, 4).map((column) => (
                          <Table.Td key={`${row.rowNumber}-${column.sourceHeader}`}>{row.values[column.sourceHeader] || '—'}</Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            </Paper>

            {requiredFieldsMissing.length > 0 ? (
              <Alert color="yellow" variant="light">
                Map {requiredFieldsMissing.join(', ')} before review can continue.
              </Alert>
            ) : (
              <Group justify="flex-end">
                <Button
                  leftSection={<IconUsers size={16} />}
                  onClick={() => void handleRunReview()}
                  loading={isReviewLoading}
                  disabled={!canManage}
                >
                  Run Reconciliation Review
                </Button>
              </Group>
            )}
          </Stack>
        ) : null}

        {reviewResult ? (
          <Stack gap="md">
            <Group gap="xs">
              <Badge color="green" variant="light">{reviewResult.readyRowCount} ready</Badge>
              <Badge color="orange" variant="light">{reviewResult.attentionRowCount} need review</Badge>
            </Group>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Row</Table.Th>
                  <Table.Th>Signals</Table.Th>
                  <Table.Th>Review detail</Table.Th>
                  <Table.Th>Candidates</Table.Th>
                  <Table.Th>Decision</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {reviewResult.rows.map((row: GroupRosterImportReviewRow) => {
                  const persistedCandidates = row.candidates.filter((candidate) => candidate.entityType !== 'import_row');
                  return (
                    <Table.Tr key={row.rowNumber}>
                      <Table.Td>
                        <Text fw={600}>#{row.rowNumber}</Text>
                        <Badge
                          mt={6}
                          color={row.status === 'ready' ? 'green' : row.status === 'invalid' ? 'red' : 'orange'}
                          variant="light"
                        >
                          {row.status.replace(/_/g, ' ')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{Object.entries(row.sourceValues).map(([key, value]) => `${key}: ${value}`).join(' · ') || '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{row.detail}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={6}>
                          {row.candidates.length === 0 ? (
                            <Text size="sm" c="dimmed">No match candidates</Text>
                          ) : row.candidates.map((candidate: GroupRosterMatchCandidate) => (
                            <Paper key={candidate.entityId} withBorder radius="md" p="xs">
                              <Group justify="space-between" align="flex-start">
                                <Stack gap={2}>
                                  <Text size="sm" fw={600}>{candidate.title}</Text>
                                  {candidate.subtitle ? <Text size="xs" c="dimmed">{candidate.subtitle}</Text> : null}
                                  {candidate.detail ? <Text size="xs" c="dimmed">{candidate.detail}</Text> : null}
                                  {candidate.conflictReason ? <Text size="xs" c="red">{candidate.conflictReason}</Text> : null}
                                </Stack>
                                <Badge variant="light" color={candidate.confidence === 'high' ? 'green' : candidate.confidence === 'medium' ? 'yellow' : 'gray'}>
                                  {candidate.confidence}
                                </Badge>
                              </Group>
                            </Paper>
                          ))}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        {row.status === 'ready' ? (
                          <Badge color="green" variant="light">Auto-ready</Badge>
                        ) : row.status === 'requires_review' ? (
                          <Stack gap="xs">
                            <Select
                              value={decisions[row.rowNumber]?.action ?? ''}
                              data={[
                                ...(persistedCandidates.length > 0 ? [{ value: 'apply', label: 'Apply to matched record' }] : []),
                                { value: 'skip', label: 'Skip row' },
                              ]}
                              placeholder="Choose action"
                              onChange={(value) => setDecisions((current) => ({
                                ...current,
                                [row.rowNumber]: {
                                  action: ((value as 'apply' | 'skip' | '') ?? ''),
                                  targetEntityId: current[row.rowNumber]?.targetEntityId ?? '',
                                },
                              }))}
                            />
                            {persistedCandidates.length > 1 ? (
                              <Select
                                value={decisions[row.rowNumber]?.targetEntityId ?? ''}
                                data={persistedCandidates.map((candidate) => ({
                                  value: candidate.entityId,
                                  label: `${candidate.entityType === 'account' ? 'Account' : 'Lead'} · ${candidate.title}`,
                                }))}
                                placeholder="Choose target record"
                                disabled={(decisions[row.rowNumber]?.action ?? '') !== 'apply'}
                                onChange={(value) => setDecisions((current) => ({
                                  ...current,
                                  [row.rowNumber]: {
                                    action: current[row.rowNumber]?.action ?? '',
                                    targetEntityId: value ?? '',
                                  },
                                }))}
                              />
                            ) : null}
                          </Stack>
                        ) : (
                          <Text size="sm" c="dimmed">No action available</Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>

            <Group justify="flex-end">
              <Button
                leftSection={<IconCheck size={16} />}
                onClick={() => void handleCommit()}
                loading={isCommitting}
                disabled={!canManage || reviewIncomplete}
              >
                Apply Roster Reconciliation
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

async function encodeFileToBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
