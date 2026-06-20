// FR-MOB-036 — account-detail tab model. Pure (no native imports) so the tab/enablement logic is
// unit-testable; the screen renders SegmentedTabs from this. The Consignment tab is greyed out when the
// account has no consignment sites; the Sales tab's YTD/last-year revenue stays parked on Acumatica.

export type AccountDetailTabKey = 'overview' | 'sales' | 'consignment' | 'history';

export const ACCOUNT_DETAIL_TABS: { key: AccountDetailTabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'sales', label: 'Sales' },
  { key: 'consignment', label: 'Consignment' },
  { key: 'history', label: 'History' },
];

// The consignment-sites list endpoint matches on display name, so filter to the exact account id.
export function resolveAccountConsignmentSites<T extends { accountId: string }>(
  sites: T[] | null | undefined,
  accountId: string,
): T[] {
  return (sites ?? []).filter((site) => site.accountId === accountId);
}

export function isConsignmentTabEnabled(sites: { length: number } | null | undefined): boolean {
  return (sites?.length ?? 0) > 0;
}
