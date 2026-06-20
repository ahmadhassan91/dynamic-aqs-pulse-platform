import type { ReportRunResult } from '@pulse/contracts';

/**
 * Client-side CSV export for saved-report run results (FR-RPT-008, CSV portion).
 * Dependency-free — Excel/PDF exports are deferred (they need a library, like the
 * charting decision). RFC-4180-style quoting + a UTF-8 BOM so Excel opens it cleanly.
 */
const UTF8_BOM = String.fromCharCode(0xfeff);

function escapeCsvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
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
  const csv = UTF8_BOM + reportRunToCsv(result);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const safeName = title.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'report';
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeName}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
