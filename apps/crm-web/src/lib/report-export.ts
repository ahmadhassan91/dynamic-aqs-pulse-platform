import type { ReportRunResult } from '@pulse/contracts';

/**
 * Client-side tabular export (FR-RPT-008 multi-format export, FR-RPT-071). CSV and Excel are dependency-free;
 * PDF lazy-loads jsPDF so it stays out of the initial bundle. Excel uses the SpreadsheetML 2003 XML format
 * (`.xls`) rather than a heavy xlsx library — it opens in Excel / LibreOffice / Google Sheets and keeps the
 * client bundle and the build risk-free.
 *
 * The `downloadTable*` core works on any `{columns, rows}` (used by report runs AND dashboard tables); the
 * `downloadReport*` wrappers adapt a saved/ad-hoc `ReportRunResult`.
 */

const UTF8_BOM = String.fromCharCode(0xfeff);

type CellValue = string | number | null | undefined;

export interface ExportColumn {
  key: string;
  label: string;
}
export type ExportRow = Record<string, CellValue>;

function cellText(value: CellValue): string {
  return value === null || value === undefined ? '' : String(value);
}

function safeFileName(title: string): string {
  return title.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'report';
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// ---- CSV (RFC-4180 quoting + UTF-8 BOM so Excel opens it cleanly) ----

function escapeCsvCell(value: CellValue): string {
  const text = cellText(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function tableToCsv(columns: ExportColumn[], rows: ExportRow[]): string {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(',');
  const body = rows.map((row) => columns.map((column) => escapeCsvCell(row[column.key])).join(','));
  return [header, ...body].join('\r\n');
}

export function downloadTableCsv(columns: ExportColumn[], rows: ExportRow[], title: string): void {
  const blob = new Blob([UTF8_BOM + tableToCsv(columns, rows)], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${safeFileName(title)}.csv`);
}

// ---- Excel (SpreadsheetML 2003 XML — dependency-free) ----

function escapeXml(value: CellValue): string {
  return cellText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function spreadsheetCell(value: CellValue): string {
  const type = typeof value === 'number' && Number.isFinite(value) ? 'Number' : 'String';
  return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

export function tableToSpreadsheetXml(columns: ExportColumn[], rows: ExportRow[], title: string): string {
  const headerRow = `<Row>${columns.map((column) => spreadsheetCell(column.label)).join('')}</Row>`;
  const dataRows = rows
    .map((row) => `<Row>${columns.map((column) => spreadsheetCell(row[column.key])).join('')}</Row>`)
    .join('');
  // Excel limits a worksheet name to 31 characters and forbids several punctuation characters.
  const sheetName = escapeXml(title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Report');
  return [
    '<?xml version="1.0"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    `<Worksheet ss:Name="${sheetName}"><Table>${headerRow}${dataRows}</Table></Worksheet>`,
    '</Workbook>',
  ].join('');
}

export function downloadTableExcel(columns: ExportColumn[], rows: ExportRow[], title: string): void {
  const blob = new Blob([tableToSpreadsheetXml(columns, rows, title)], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  triggerDownload(blob, `${safeFileName(title)}.xls`);
}

// ---- PDF (jsPDF + autotable, lazy-loaded so it stays out of the initial bundle) ----

export async function downloadTablePdf(
  columns: ExportColumn[],
  rows: ExportRow[],
  title: string,
  subtitle?: string,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  // Wide tables read better in landscape.
  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait', unit: 'pt' });
  doc.setFontSize(14);
  doc.text(title, 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(subtitle ?? `${rows.length} row${rows.length === 1 ? '' : 's'} · generated ${new Date().toLocaleString()}`, 40, 56);

  autoTable(doc, {
    startY: 72,
    head: [columns.map((column) => column.label)],
    body: rows.map((row) => columns.map((column) => cellText(row[column.key]))),
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [33, 37, 41] },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${safeFileName(title)}.pdf`);
}

// ---- Report-run wrappers (adapt a ReportRunResult to the table core) ----

export function reportRunToCsv(result: ReportRunResult): string {
  return tableToCsv(result.columns, result.rows);
}

export function downloadReportCsv(result: ReportRunResult, title: string): void {
  downloadTableCsv(result.columns, result.rows, title);
}

export function reportRunToSpreadsheetXml(result: ReportRunResult, title: string): string {
  return tableToSpreadsheetXml(result.columns, result.rows, title);
}

export function downloadReportExcel(result: ReportRunResult, title: string): void {
  downloadTableExcel(result.columns, result.rows, title);
}

export async function downloadReportPdf(result: ReportRunResult, title: string): Promise<void> {
  const subtitle = `${result.rowCount} row${result.rowCount === 1 ? '' : 's'} · generated ${new Date(result.generatedAt).toLocaleString()}`;
  await downloadTablePdf(result.columns, result.rows, title, subtitle);
}
