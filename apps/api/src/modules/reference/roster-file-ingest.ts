import { read, utils } from 'xlsx';
import type {
  GroupRosterImportColumnMapping,
  GroupRosterImportColumnPreview,
  GroupRosterImportFilePreviewRequest,
  GroupRosterImportFilePreviewResponse,
  GroupRosterImportPreviewRow,
  GroupRosterImportTargetFieldKey,
  GroupRosterImportTargetFieldOption,
  ReviewGroupRosterImportRequest,
} from '@pulse/contracts';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 1000;
const MAX_PREVIEW_ROWS = 5;

export type GroupRosterImportMappedRow = {
  companyName?: string;
  contactDisplayName?: string;
  email?: string;
  phone?: string;
  state?: string;
  city?: string;
};

const GROUP_ROSTER_IMPORT_TARGET_FIELD_OPTIONS: readonly GroupRosterImportTargetFieldOption[] = [
  { value: 'companyName', label: 'Company Name' },
  { value: 'contactDisplayName', label: 'Contact Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'state', label: 'State / Province' },
  { value: 'city', label: 'City' },
] as const;

type ParsedGroupRosterImportFile = {
  format: 'csv' | 'xlsx';
  fileName: string;
  sheetName: string;
  availableSheets: string[];
  headers: string[];
  rows: GroupRosterImportPreviewRow[];
};

export function previewGroupRosterImportFile(input: GroupRosterImportFilePreviewRequest): GroupRosterImportFilePreviewResponse {
  const parsed = parseGroupRosterImportFile(input);

  const columns: GroupRosterImportColumnPreview[] = parsed.headers.map((header) => {
    const sampleValue = parsed.rows[0]?.values[header];
    const suggestedTargetField = suggestTargetField(header);

    return {
      sourceHeader: header,
      ...(sampleValue ? { sampleValue } : {}),
      ...(suggestedTargetField ? { suggestedTargetField } : {}),
    };
  });

  return {
    fileName: parsed.fileName,
    format: parsed.format,
    sheetName: parsed.sheetName,
    availableSheets: parsed.availableSheets,
    totalRows: parsed.rows.length,
    targetFieldOptions: [...GROUP_ROSTER_IMPORT_TARGET_FIELD_OPTIONS],
    columns,
    previewRows: parsed.rows.slice(0, MAX_PREVIEW_ROWS),
  };
}

export function mapGroupRosterImportFile(
  input: ReviewGroupRosterImportRequest,
): {
  format: 'csv' | 'xlsx';
  fileName: string;
  sheetName: string;
  totalRows: number;
  rows: GroupRosterImportMappedRow[];
  rowNumbers: number[];
  sourceRows: GroupRosterImportPreviewRow[];
} {
  const parsed = parseGroupRosterImportFile(input);
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Group roster import file cannot exceed ${MAX_IMPORT_ROWS} data rows`);
  }

  const normalizedMappings = normalizeMappings(input.mappings, parsed.headers);
  const rows: GroupRosterImportMappedRow[] = [];
  const rowNumbers: number[] = [];

  for (const row of parsed.rows) {
    rows.push(mapParsedRow(row, normalizedMappings));
    rowNumbers.push(row.rowNumber);
  }

  return {
    format: parsed.format,
    fileName: parsed.fileName,
    sheetName: parsed.sheetName,
    totalRows: parsed.rows.length,
    rows,
    rowNumbers,
    sourceRows: parsed.rows,
  };
}

function parseGroupRosterImportFile(input: GroupRosterImportFilePreviewRequest): ParsedGroupRosterImportFile {
  const fileName = input.fileName?.trim();
  if (!fileName) {
    throw new Error('fileName is required');
  }

  const format = inferFileFormat(fileName);
  const buffer = decodeBase64File(input.fileContentBase64);
  const workbook = read(buffer, {
    type: 'buffer',
    raw: false,
    cellText: true,
    dense: true,
  });

  const availableSheets = workbook.SheetNames;
  if (availableSheets.length === 0) {
    throw new Error('The uploaded file does not contain any readable sheets');
  }

  const defaultSheet = availableSheets[0];
  if (!defaultSheet) {
    throw new Error('The uploaded file does not contain any readable sheets');
  }

  const selectedSheet = input.sheetName?.trim() || defaultSheet;
  if (!availableSheets.includes(selectedSheet)) {
    throw new Error(`Sheet not found in workbook: ${selectedSheet}`);
  }

  const sheet = workbook.Sheets[selectedSheet];
  if (!sheet) {
    throw new Error(`Sheet is not readable: ${selectedSheet}`);
  }

  const rows = utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    blankrows: false,
    defval: '',
  }) as unknown[][];

  if (rows.length === 0) {
    throw new Error('The uploaded file does not contain any rows');
  }

  const headerRow = rows[0] ?? [];
  const headers = uniquifyHeaders(
    headerRow.map((cell, index) => normalizeHeaderCell(cell, index)),
  );
  if (headers.length === 0) {
    throw new Error('The uploaded file does not contain any usable headers');
  }

  const dataRows = rows.slice(1)
    .map((cells, index) => buildPreviewRow(headers, cells, index + 2))
    .filter((row) => Object.values(row.values).some((value) => value.length > 0));

  return {
    format,
    fileName,
    sheetName: selectedSheet,
    availableSheets,
    headers,
    rows: dataRows,
  };
}

function buildPreviewRow(headers: string[], cells: unknown[], rowNumber: number): GroupRosterImportPreviewRow {
  const values: Record<string, string> = {};

  for (const [index, header] of headers.entries()) {
    values[header] = normalizeCellValue(cells[index]);
  }

  return {
    rowNumber,
    values,
  };
}

function normalizeMappings(mappings: GroupRosterImportColumnMapping[], headers: string[]) {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    throw new Error('mappings must contain at least one item');
  }

  const seenTargets = new Set<GroupRosterImportTargetFieldKey>();
  const headerSet = new Set(headers);
  const normalized = new Map<string, GroupRosterImportTargetFieldKey>();

  for (const mapping of mappings) {
    const sourceHeader = mapping.sourceHeader?.trim();
    if (!sourceHeader) {
      throw new Error('Each mapping must include a sourceHeader');
    }
    if (!headerSet.has(sourceHeader)) {
      throw new Error(`Mapping references an unknown header: ${sourceHeader}`);
    }
    if (!mapping.targetField) {
      continue;
    }
    if (seenTargets.has(mapping.targetField)) {
      throw new Error(`Duplicate target field in mappings: ${mapping.targetField}`);
    }

    seenTargets.add(mapping.targetField);
    normalized.set(sourceHeader, mapping.targetField);
  }

  if (normalized.size === 0) {
    throw new Error('At least one target field must be mapped');
  }

  return normalized;
}

function mapParsedRow(
  row: GroupRosterImportPreviewRow,
  mappings: Map<string, GroupRosterImportTargetFieldKey>,
): GroupRosterImportMappedRow {
  const mapped: GroupRosterImportMappedRow = {};

  for (const [sourceHeader, targetField] of mappings.entries()) {
    const rawValue = row.values[sourceHeader];
    if (!rawValue) {
      continue;
    }

    const value = rawValue.trim();
    if (value) {
      mapped[targetField] = value;
    }
  }

  return mapped;
}

function suggestTargetField(header: string): GroupRosterImportTargetFieldKey | undefined {
  const normalized = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');

  if (normalized.includes('company') || normalized.includes('account name') || normalized.includes('business name')) {
    return 'companyName';
  }
  if (normalized.includes('contact') || normalized.includes('owner name') || normalized.includes('member name')) {
    return 'contactDisplayName';
  }
  if (normalized.includes('email')) {
    return 'email';
  }
  if (normalized.includes('phone') || normalized.includes('mobile')) {
    return 'phone';
  }
  if (normalized.includes('state') || normalized.includes('province')) {
    return 'state';
  }
  if (normalized.includes('city')) {
    return 'city';
  }

  return undefined;
}

function inferFileFormat(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'xlsx') {
    return 'xlsx';
  }
  if (extension === 'csv') {
    return 'csv';
  }

  throw new Error('Only CSV and XLSX files are supported');
}

function decodeBase64File(value: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error('fileContentBase64 is required');
  }

  const buffer = Buffer.from(trimmed, 'base64');
  if (buffer.length === 0) {
    throw new Error('Uploaded file is empty');
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(`Uploaded file exceeds the ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB limit`);
  }

  return buffer;
}

function normalizeHeaderCell(value: unknown, index: number) {
  const text = normalizeCellValue(value).trim();
  return text || `Column ${index + 1}`;
}

function uniquifyHeaders(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((header) => {
    const current = seen.get(header) ?? 0;
    seen.set(header, current + 1);
    return current === 0 ? header : `${header} (${current + 1})`;
  });
}

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}
