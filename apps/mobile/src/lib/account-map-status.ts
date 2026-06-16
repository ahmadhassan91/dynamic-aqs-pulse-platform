import type { AccountSummary } from '@pulse/contracts/accounts';

// Field-map marker statuses mirroring the MapMyCustomers color conventions the TMs rely on daily
// (Session 10: "dark green is sold account, light green is active lead, blue is members list,
// purple is onboarding"). NOTE: the derivation rules below are a sensible default from the fields
// available on AccountSummary and MUST be confirmed with the business — the exact definition of
// "sold" vs "active" and how leads (a separate entity) appear on the map is an open decision.
export type AccountMapStatus = 'sold' | 'active' | 'member' | 'onboarding' | 'consignment' | 'consignment_overdue' | 'inactive';

export const ACCOUNT_MAP_STATUS_META: Record<AccountMapStatus, { label: string; color: string }> = {
  sold: { label: 'Sold account', color: '#2F9E44' }, // dark green
  active: { label: 'Active', color: '#69DB7C' }, // light green
  member: { label: 'Member', color: '#1971C2' }, // blue
  onboarding: { label: 'Onboarding', color: '#9C36B5' }, // purple
  // CG (Session 10): preserve the Map My Customer colours UNCHANGED and ADD the consignment piece
  // as a NEW distinct colour. The two below are PLACEHOLDERS (amber / red) pending Currie's
  // authoritative colour list and the overdue definition (OQ-MOB-09). When that list lands this is
  // a one-file hex swap — no logic change.
  consignment: { label: 'Consignment', color: '#F08C00' }, // TODO placeholder (amber)
  consignment_overdue: { label: 'Consignment overdue', color: '#E03131' }, // TODO placeholder (red)
  inactive: { label: 'Inactive', color: '#868E96' }, // gray
};

export const ACCOUNT_MAP_STATUS_ORDER: AccountMapStatus[] = ['sold', 'active', 'member', 'onboarding', 'consignment', 'consignment_overdue', 'inactive'];

// An account's consignment overdue overlay for the map. Participation / onboarding-vs-active is read
// from account.consignment (the account-level read model, which is NOT due-window-filtered); this
// signal only adds the overdue flag, which that read model does not carry — see buildConsignmentSignalMap.
export type ConsignmentMapSignal = { isOverdue: boolean };

type DerivableAccount = Pick<AccountSummary, 'lifecycleStatus' | 'consignment' | 'groupClassification' | 'lastOrderAt'>;

export function deriveAccountMapStatus(account: DerivableAccount, consignment?: ConsignmentMapSignal): AccountMapStatus {
  if (account.lifecycleStatus === 'inactive' || account.lifecycleStatus === 'churned') {
    return 'inactive';
  }
  // Live consignment participation (≥1 ACTIVE site) is the new operational overlay the field needs
  // at a glance (ROSE audits). It is checked ahead of onboarding/sold/member/active so an active
  // consignment account gets the consignment colour rather than purple/green. NOTE: that consignment
  // outranks "sold" is a product assumption pending confirmation (OQ-MOB-09), like the sold-vs-active
  // rule flagged above. activeSiteCount comes from the account read model, so it is unaffected by the
  // due-window filter on the per-site list that only feeds the overdue flag.
  if (account.consignment && account.consignment.activeSiteCount > 0) {
    return consignment?.isOverdue ? 'consignment_overdue' : 'consignment';
  }
  // Consignment onboarding (sites being set up — not yet ACTIVE) keeps the existing purple.
  if (account.consignment && account.consignment.onboardingSiteCount > 0) {
    return 'onboarding';
  }
  if (account.lastOrderAt) {
    return 'sold';
  }
  if (account.groupClassification && account.groupClassification !== 'independent') {
    return 'member';
  }
  return 'active';
}

export function accountMapColor(account: DerivableAccount, consignment?: ConsignmentMapSignal): string {
  return ACCOUNT_MAP_STATUS_META[deriveAccountMapStatus(account, consignment)].color;
}

type ConsignmentSiteSignalInput = { accountId: string; status?: string; nextAuditDueAt?: string };

// Build an accountId -> overdue signal from the consignment sites the field screens already fetch
// (no extra API call). This ONLY computes the overdue flag (the account read model lacks it);
// participation/onboarding come from account.consignment in deriveAccountMapStatus. We scan ONLY
// 'active' sites: deriveAccountMapStatus consults isOverdue solely in its activeSiteCount > 0 branch,
// so an overdue onboarding/suspended/exiting/exited site would produce a signal the gate always
// discards. "Overdue" = an active site whose nextAuditDueAt is in the past — the same strict-`<`
// predicate as countOverdueRoseSites in today-metrics.ts, narrowed here to active sites. The per-site
// list is fetched with dueWithinDays:45, which is complete for overdue (an overdue audit is by
// definition already past due, well inside the window). The overdue *definition* — and whether
// suspended/exiting sites should ever colour overdue — is a product decision (OQ-MOB-09).
export function buildConsignmentSignalMap(sites: ConsignmentSiteSignalInput[], now: Date): Map<string, ConsignmentMapSignal> {
  const signals = new Map<string, ConsignmentMapSignal>();
  for (const site of sites) {
    if (site.status !== 'active') continue;
    const overdue = site.nextAuditDueAt ? new Date(site.nextAuditDueAt).getTime() < now.getTime() : false;
    if (overdue) signals.set(site.accountId, { isOverdue: true });
  }
  return signals;
}

const GROUP_CLASSIFICATION_LABELS: Record<string, string> = {
  independent: 'Independent',
  affinity_only: 'Affinity only',
  ownership_only: 'Ownership only',
  hybrid: 'Hybrid',
};

// Humanize the dealer-group classification key (e.g. 'affinity_only' -> 'Affinity only') so the
// field UI never surfaces raw enum keys. Returns undefined for empty input so callers can ?? a default.
export function formatGroupClassification(value?: string | null): string | undefined {
  if (!value) return undefined;
  return (
    GROUP_CLASSIFICATION_LABELS[value] ??
    value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

// A geocodable address. AccountSummary now carries server-derived latitude/longitude (city/state
// level) which the field map uses directly; this address-key helper remains for an optional
// client-side geocoding fallback (e.g. exact street-level positioning later).
export type MappableAddress = { city?: string | null; state?: string | null; postalCode?: string | null };

// Address string used as the geocoding key (kept here, free of native imports, so it is unit-testable).
export function accountAddressKey(account: MappableAddress): string | null {
  const parts = [account.city, account.state, account.postalCode]
    .map((part) => (part ?? '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}
