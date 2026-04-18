'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Code,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { IconEdit, IconFileImport, IconPlus } from '@tabler/icons-react';

export type GroupReferenceOption = {
  value: string;
  label: string;
};

export type GroupReferenceRecord = {
  id: string;
  code: string;
  name: string;
  shortName?: string;
  description?: string;
  notes?: string;
  isActive: boolean;
  sortOrder: number;
  typeValue: string;
};

export type GroupReferenceDraft = {
  code: string;
  name: string;
  shortName: string;
  description: string;
  notes: string;
  isActive: boolean;
  sortOrder: number;
  typeValue: string;
};

type GroupReferenceImportPayload = {
  batchName?: string;
  sourceLabel?: string;
  rows: GroupReferenceDraft[];
};

type GroupReferenceManagerProps = {
  title: string;
  description: string;
  emptyMessage: string;
  typeLabel: string;
  importTypeField: string;
  items: GroupReferenceRecord[];
  typeOptions: GroupReferenceOption[];
  canManage: boolean;
  onCreate: (draft: GroupReferenceDraft) => Promise<void>;
  onUpdate: (id: string, draft: GroupReferenceDraft) => Promise<void>;
  onImport: (payload: GroupReferenceImportPayload) => Promise<void>;
};

const initialDraft: GroupReferenceDraft = {
  code: '',
  name: '',
  shortName: '',
  description: '',
  notes: '',
  isActive: true,
  sortOrder: 0,
  typeValue: '',
};

export function GroupReferenceManager({
  title,
  description,
  emptyMessage,
  typeLabel,
  importTypeField,
  items,
  typeOptions,
  canManage,
  onCreate,
  onUpdate,
  onImport,
}: GroupReferenceManagerProps) {
  const [draft, setDraft] = useState<GroupReferenceDraft>(initialDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importBatchName, setImportBatchName] = useState('');
  const [importSourceLabel, setImportSourceLabel] = useState('');
  const [importRowsText, setImportRowsText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const typeLabels = useMemo(
    () => new Map(typeOptions.map((option) => [option.value, option.label])),
    [typeOptions],
  );

  function resetDraft() {
    setDraft(initialDraft);
    setEditingId(null);
    setErrorMessage(null);
  }

  function openCreateModal() {
    resetDraft();
    setEditorOpen(true);
  }

  function openEditModal(item: GroupReferenceRecord) {
    setDraft({
      code: item.code,
      name: item.name,
      shortName: item.shortName ?? '',
      description: item.description ?? '',
      notes: item.notes ?? '',
      isActive: item.isActive,
      sortOrder: item.sortOrder,
      typeValue: item.typeValue,
    });
    setEditingId(item.id);
    setErrorMessage(null);
    setEditorOpen(true);
  }

  async function handleSave() {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      if (!draft.code.trim()) {
        throw new Error('Code is required');
      }
      if (!draft.name.trim()) {
        throw new Error('Name is required');
      }
      if (!draft.typeValue) {
        throw new Error(`${typeLabel} is required`);
      }

      if (editingId) {
        await onUpdate(editingId, draft);
      } else {
        await onCreate(draft);
      }
      setEditorOpen(false);
      resetDraft();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImport() {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const rows = parseImportRows(importRowsText, importTypeField);
      await onImport({
        ...(importBatchName.trim() ? { batchName: importBatchName.trim() } : {}),
        ...(importSourceLabel.trim() ? { sourceLabel: importSourceLabel.trim() } : {}),
        rows,
      });
      setImportOpen(false);
      setImportBatchName('');
      setImportSourceLabel('');
      setImportRowsText('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Title order={4}>{title}</Title>
            <Text size="sm" c="dimmed">{description}</Text>
            <Group gap="xs">
              <Badge variant="light" color="blue">{items.length} total</Badge>
              <Badge variant="light" color="green">{items.filter((item) => item.isActive).length} active</Badge>
            </Group>
          </Stack>
          {canManage ? (
            <Group gap="xs">
              <Button variant="light" leftSection={<IconFileImport size={16} />} onClick={() => {
                setErrorMessage(null);
                setImportOpen(true);
              }}>
                Import
              </Button>
              <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
                Add
              </Button>
            </Group>
          ) : null}
        </Group>

        {!canManage ? (
          <Alert color="gray" variant="light">
            Your current role can review these governed values, but only admins can add, edit, or import them.
          </Alert>
        ) : null}

        {items.length === 0 ? (
          <Alert color="blue" variant="light">{emptyMessage}</Alert>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Code</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>{typeLabel}</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Order</Table.Th>
                <Table.Th>Notes</Table.Th>
                {canManage ? <Table.Th>Actions</Table.Th> : null}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Text ff="monospace" size="sm">{item.code}</Text>
                    {item.shortName ? (
                      <Text size="xs" c="dimmed">{item.shortName}</Text>
                    ) : null}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={600}>{item.name}</Text>
                    {item.description ? <Text size="xs" c="dimmed">{item.description}</Text> : null}
                  </Table.Td>
                  <Table.Td>{typeLabels.get(item.typeValue) ?? item.typeValue}</Table.Td>
                  <Table.Td>
                    <Badge color={item.isActive ? 'green' : 'gray'} variant="light">
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{item.sortOrder}</Table.Td>
                  <Table.Td>{item.notes ?? '—'}</Table.Td>
                  {canManage ? (
                    <Table.Td>
                      <Button variant="subtle" leftSection={<IconEdit size={14} />} onClick={() => openEditModal(item)}>
                        Edit
                      </Button>
                    </Table.Td>
                  ) : null}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>

      <Modal
        opened={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          resetDraft();
        }}
        title={editingId ? `Edit ${title}` : `Add ${title}`}
        size="lg"
      >
        <Stack gap="md">
          {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}
          <Group grow>
            <TextInput
              label="Code"
              value={draft.code}
              onChange={(event) => setDraft((current) => ({ ...current, code: event.currentTarget.value }))}
              disabled={editingId !== null}
              placeholder="NEXSTAR"
            />
            <TextInput
              label="Name"
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.currentTarget.value }))}
              placeholder="Nexstar Network"
            />
          </Group>
          <Group grow>
            <TextInput
              label="Short name"
              value={draft.shortName}
              onChange={(event) => setDraft((current) => ({ ...current, shortName: event.currentTarget.value }))}
              placeholder="Nexstar"
            />
            <Select
              label={typeLabel}
              value={draft.typeValue}
              onChange={(value) => setDraft((current) => ({ ...current, typeValue: value ?? '' }))}
              data={typeOptions}
            />
          </Group>
          <Group grow align="flex-end">
            <NumberInput
              label="Sort order"
              value={draft.sortOrder}
              min={0}
              allowDecimal={false}
              onChange={(value) => setDraft((current) => ({
                ...current,
                sortOrder: typeof value === 'number' ? value : current.sortOrder,
              }))}
            />
            <Switch
              label="Active"
              checked={draft.isActive}
              onChange={(event) => setDraft((current) => ({ ...current, isActive: event.currentTarget.checked }))}
            />
          </Group>
          <Textarea
            label="Description"
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.currentTarget.value }))}
            minRows={2}
          />
          <Textarea
            label="Notes"
            value={draft.notes}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.currentTarget.value }))}
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => {
              setEditorOpen(false);
              resetDraft();
            }}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} loading={submitting}>
              {editingId ? 'Save' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={importOpen}
        onClose={() => {
          setImportOpen(false);
          setImportBatchName('');
          setImportSourceLabel('');
          setImportRowsText('');
          setErrorMessage(null);
        }}
        title={`Import ${title}`}
        size="xl"
      >
        <Stack gap="md">
          {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}
          <Alert color="blue" variant="light">
            Paste tab-separated or comma-separated rows with a header line. Recommended columns: <Code>code</Code>, <Code>name</Code>, <Code>{importTypeField}</Code>, <Code>shortName</Code>, <Code>description</Code>, <Code>sortOrder</Code>, <Code>isActive</Code>, <Code>notes</Code>.
          </Alert>
          <Code block>{`code\tname\t${importTypeField}\tshortName\tdescription\tsortOrder\tisActive\tnotes\nEXAMPLE\tExample Group\t${typeOptions[0]?.value ?? 'other'}\tExample\tOptional description\t10\ttrue\tOptional notes`}</Code>
          <Group grow>
            <TextInput
              label="Batch name"
              value={importBatchName}
              onChange={(event) => setImportBatchName(event.currentTarget.value)}
              placeholder="Q2 stewardship refresh"
            />
            <TextInput
              label="Source label"
              value={importSourceLabel}
              onChange={(event) => setImportSourceLabel(event.currentTarget.value)}
              placeholder="ops spreadsheet"
            />
          </Group>
          <Textarea
            label="Rows"
            value={importRowsText}
            onChange={(event) => setImportRowsText(event.currentTarget.value)}
            minRows={10}
            placeholder={`code\tname\t${importTypeField}`}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => {
              setImportOpen(false);
              setImportBatchName('');
              setImportSourceLabel('');
              setImportRowsText('');
              setErrorMessage(null);
            }}>
              Cancel
            </Button>
            <Button onClick={() => void handleImport()} loading={submitting}>
              Import
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}

function parseImportRows(value: string, typeField: string): GroupReferenceDraft[] {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Import rows are required');
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('Add a header row and at least one data row');
  }

  const [headerLine] = lines;
  if (!headerLine) {
    throw new Error('Header row is required');
  }

  const delimiter = headerLine.includes('\t') ? '\t' : ',';
  const headers = splitSimpleDelimitedLine(headerLine, delimiter).map((entry) => entry.trim());
  const indexByHeader = new Map(headers.map((header, index) => [header, index]));

  if (!indexByHeader.has('code') || !indexByHeader.has('name') || !indexByHeader.has(typeField)) {
    throw new Error(`Header row must include code, name, and ${typeField}`);
  }

  return lines.slice(1).map((line, rowIndex) => {
    const columns = splitSimpleDelimitedLine(line, delimiter);
    const code = readDelimitedField(columns, indexByHeader, 'code');
    const name = readDelimitedField(columns, indexByHeader, 'name');
    const typeValue = readDelimitedField(columns, indexByHeader, typeField);

    if (!code || !name || !typeValue) {
      throw new Error(`Row ${rowIndex + 2} is missing a required field`);
    }

    return {
      code,
      name,
      typeValue,
      shortName: readDelimitedField(columns, indexByHeader, 'shortName') ?? '',
      description: readDelimitedField(columns, indexByHeader, 'description') ?? '',
      notes: readDelimitedField(columns, indexByHeader, 'notes') ?? '',
      sortOrder: parseOptionalInteger(readDelimitedField(columns, indexByHeader, 'sortOrder')),
      isActive: parseOptionalBoolean(readDelimitedField(columns, indexByHeader, 'isActive')) ?? true,
    };
  });
}

function splitSimpleDelimitedLine(value: string, delimiter: string) {
  return value.split(delimiter).map((entry) => entry.trim());
}

function readDelimitedField(columns: string[], indexByHeader: Map<string, number>, field: string) {
  const index = indexByHeader.get(field);
  if (index === undefined) {
    return undefined;
  }

  const value = columns[index]?.trim();
  return value ? value : undefined;
}

function parseOptionalInteger(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid sortOrder value: ${value}`);
  }

  return parsed;
}

function parseOptionalBoolean(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', 'yes', '1', 'active'].includes(normalized)) {
    return true;
  }
  if (['false', 'no', '0', 'inactive'].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid isActive value: ${value}`);
}
