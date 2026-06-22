import type { ReportRunResult } from '@pulse/contracts';

/**
 * Client-side export for saved-report / ad-hoc run results (FR-RPT-008 multi-format export, FR-RPT-071).
 * CSV and Excel are dependency-free; PDF lazy-loads jsPDF so it stays out of the initial bundle.
 *
 * Excel uses the SpreadsheetML 2003 XML format (`.xls`) rather than a heavy xlsx library — it opens in
 * Excel / LibreOffice / Google Sheets and keeps the client bundle and the build risk-free.
 */

const UTF8_BOM = String.fromCharCode(0xfeff);

type CellValue = string | number | null | undefined;

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

export function reportRunToCsv(result: ReportRunResult): string {
  const header = result.columns.map((column) => escapeCsvCell(column.label)).join(',');
  const rows = result.rows.map((row) =>
    result.columns.map((column) => escapeCsvCell(row[column.key])).join(','),
  );
  return [header, ...rows].join('\r\n');
}

export function downloadReportCsv(result: ReportRunResult, title: string): void {
  const blob = new Blob([UTF8_BOM + reportRunToCsv(result)], { type: 'text/csv;charset=utf-8;' });
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

export function reportRunToSpreadsheetXml(result: ReportRunResult, title: string): string {
  const headerRow = `<Row>${result.columns.map((column) => spreadsheetCell(column.label)).join('')}</Row>`;
  const dataRows = result.rows
    .map((row) => `<Row>${result.columns.map((column) => spreadsheetCell(row[column.key])).join('')}</Row>`)
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

export function downloadReportExcel(result: ReportRunResult, title: string): void {
  const blob = new Blob([reportRunToSpreadsheetXml(result, title)], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  triggerDownload(blob, `${safeFileName(title)}.xls`);
}

// ---- PDF (jsPDF + autotable, lazy-loaded so it stays out of the initial bundle) ----

export async function downloadReportPdf(result: ReportRunResult, title: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  // Wide reports read better in landscape.
  const doc = new jsPDF({ orientation: result.columns.length > 5 ? 'landscape' : 'portrait', unit: 'pt' });
  doc.setFontSize(14);
  doc.text(title, 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `${result.rowCount} row${result.rowCount === 1 ? '' : 's'} · generated ${new Date(result.generatedAt).toLocaleString()}`,
    40,
    56,
  );

  autoTable(doc, {
    startY: 72,
    head: [result.columns.map((column) => column.label)],
    body: result.rows.map((row) => result.columns.map((column) => cellText(row[column.key]))),
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [33, 37, 41] },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${safeFileName(title)}.pdf`);
}
