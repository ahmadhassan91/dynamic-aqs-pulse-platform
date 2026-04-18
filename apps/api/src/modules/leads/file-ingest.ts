import { read, utils } from 'xlsx';
import type {
  ImportLeadFileRequest,
  ImportLeadRowInput,
  LeadImportColumnMapping,
  LeadImportColumnPreview,
  LeadImportFilePreviewRequest,
  LeadImportFilePreviewResponse,
  LeadImportPreviewRow,
  LeadImportTargetFieldKey,
  LeadImportTargetFieldOption,
} from '@pulse/contracts';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 500;
const MAX_PREVIEW_ROWS = 5;

const LEAD_IMPORT_TARGET_FIELD_OPTIONS: readonly LeadImportTargetFieldOption[] = [
  { value: 'companyName', label: 'Company Name' },
  { value: 'contactFirstName', label: 'Contact First Name' },
  { value: 'contactLastName', label: 'Contact Last Name' },
  { value: 'contactDisplayName', label: 'Contact Display Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'state', label: 'State / Province' },
  { value: 'countryCode', label: 'Country Code' },
  { value: 'sourceDetail', label: 'Source Detail' },
  { value: 'leadRating', label: 'Lead Rating' },
  { value: 'serviceTechCount', label: 'Service Tech Count' },
  { value: 'installTechCount', label: 'Install Tech Count' },
  { value: 'truckCount', label: 'Truck Count' },
  { value: 'salesPersonCount', label: 'Salesperson Count' },
  { value: 'affinityGroupName', label: 'Affinity Group' },
  { value: 'ownershipGroupName', label: 'Ownership Group' },
  { value: 'privateLabelName', label: 'Private Label' },
  { value: 'notes', label: 'Notes' },
] as const;

type ParsedLeadImportFile = {
  format: 'csv' | 'xlsx';
  fileName: string;
  sheetName: string;
  availableSheets: string[];
  headers: string[];
  rows: LeadImportPreviewRow[];
};

export function previewLeadImportFile(input: LeadImportFilePreviewRequest): LeadImportFilePreviewResponse {
  const parsed = parseLeadImportFile(input);

  const columns: LeadImportColumnPreview[] = parsed.headers.map((header) => {
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
    targetFieldOptions: [...LEAD_IMPORT_TARGET_FIELD_OPTIONS],
    columns,
    previewRows: parsed.rows.slice(0, MAX_PREVIEW_ROWS),
  };
}

export function mapLeadImportFile(
  input: ImportLeadFileRequest,
): {
  format: 'csv' | 'xlsx';
  fileName: string;
  sheetName: string;
  totalRows: number;
  rows: ImportLeadRowInput[];
  rowNumbers: number[];
  sourceRows: LeadImportPreviewRow[];
} {
  const parsed = parseLeadImportFile(input);
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Lead import file cannot exceed ${MAX_IMPORT_ROWS} data rows`);
  }

  const normalizedMappings = normalizeMappings(input.mappings, parsed.headers);
  const rows: ImportLeadRowInput[] = [];
  const rowNumbers: number[] = [];

  for (const row of parsed.rows) {
    const mapped = mapParsedRow(row, normalizedMappings);
    rows.push(mapped);
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

function parseLeadImportFile(input: LeadImportFilePreviewRequest): ParsedLeadImportFile {
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

function buildPreviewRow(headers: string[], cells: unknown[], rowNumber: number): LeadImportPreviewRow {
  const values: Record<string, string> = {};

  for (const [index, header] of headers.entries()) {
    values[header] = normalizeCellValue(cells[index]);
  }

  return {
    rowNumber,
    values,
  };
}

function normalizeMappings(mappings: LeadImportColumnMapping[], headers: string[]) {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    throw new Error('mappings must contain at least one item');
  }

  const seenTargets = new Set<LeadImportTargetFieldKey>();
  const headerSet = new Set(headers);
  const normalized = new Map<string, LeadImportTargetFieldKey>();

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
  row: LeadImportPreviewRow,
  mappings: Map<string, LeadImportTargetFieldKey>,
): ImportLeadRowInput {
  const mapped: ImportLeadRowInput = {};

  for (const [sourceHeader, targetField] of mappings.entries()) {
    const rawValue = row.values[sourceHeader];
    if (!rawValue) {
      continue;
    }

    switch (targetField) {
      case 'serviceTechCount':
      case 'installTechCount':
      case 'truckCount':
      case 'salesPersonCount':
      case 'potentialValueCents': {
        const parsed = parseOptionalInteger(rawValue);
        if (parsed !== undefined) {
          mapped[targetField] = parsed;
        }
        break;
      }
      default: {
        const value = rawValue.trim();
        if (value) {
          mapped[targetField] = value;
        }
        break;
      }
    }
  }

  return mapped;
}

function decodeBase64File(value: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error('fileContentBase64 is required');
  }

  const payload = trimmed.includes(',') ? trimmed.split(',').pop() ?? trimmed : trimmed;
  const buffer = Buffer.from(payload, 'base64');
  if (buffer.length === 0) {
    throw new Error('fileContentBase64 could not be decoded');
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(`Uploaded file exceeds the ${MAX_FILE_BYTES} byte limit`);
  }

  return buffer;
}

function inferFileFormat(fileName: string): 'csv' | 'xlsx' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
    return 'csv';
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return 'xlsx';
  }

  throw new Error('Unsupported file type. Only CSV and XLSX are supported');
}

function normalizeHeaderCell(cell: unknown, index: number) {
  const value = normalizeCellValue(cell);
  return value || `Column ${index + 1}`;
}

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function uniquifyHeaders(headers: string[]) {
  const seen = new Map<string, number>();

  return headers.map((header) => {
    const current = seen.get(header) ?? 0;
    seen.set(header, current + 1);

    if (current === 0) {
      return header;
    }

    return `${header} (${current + 1})`;
  });
}

function parseOptionalInteger(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized.replace(/,/g, ''));
  if (!Number.isInteger(parsed) || Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
}

function suggestTargetField(header: string): LeadImportTargetFieldKey | undefined {
  const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normalized.includes('company') || normalized.includes('business') || normalized.includes('org')) return 'companyName';
  if (normalized.includes('firstname') || normalized === 'first' || normalized === 'fname') return 'contactFirstName';
  if (normalized.includes('lastname') || normalized.includes('surname') || normalized === 'lname') return 'contactLastName';
  if (normalized.includes('contactname') || (normalized.includes('name') && !normalized.includes('company'))) return 'contactDisplayName';
  if (normalized.includes('email') || normalized.includes('mail')) return 'email';
  if (normalized.includes('phone') || normalized.includes('cell') || normalized.includes('mobile') || normalized.includes('tel')) return 'phone';
  if (normalized === 'state' || normalized === 'st' || normalized.includes('province')) return 'state';
  if (normalized.includes('country')) return 'countryCode';
  if (normalized.includes('servicetech') || normalized.includes('technician') || normalized.includes('techcount') || normalized.includes('numoftechs') || normalized === 'techs') return 'serviceTechCount';
  if (normalized.includes('installtech') || normalized.includes('installercount')) return 'installTechCount';
  if (normalized.includes('truck') || normalized.includes('fleet') || normalized.includes('vehicle')) return 'truckCount';
  if (normalized.includes('salesperson') || normalized.includes('salesrep') || normalized.includes('salescount')) return 'salesPersonCount';
  if (normalized.includes('source') || normalized.includes('channel') || normalized.includes('origin')) return 'sourceDetail';
  if (normalized.includes('rating') || normalized.includes('score')) return 'leadRating';
  if (normalized.includes('affinity')) return 'affinityGroupName';
  if (normalized.includes('ownership') || normalized.includes('privateequity') || normalized.includes('pegroup')) return 'ownershipGroupName';
  if (normalized.includes('privatelabel') || normalized.includes('brand')) return 'privateLabelName';
  if (normalized.includes('note') || normalized.includes('comment') || normalized.includes('remark')) return 'notes';

  return undefined;
}
