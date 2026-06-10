import type { AccountSummary } from '@pulse/contracts/accounts';

// Field-map marker statuses mirroring the MapMyCustomers color conventions the TMs rely on daily
// (Session 10: "dark green is sold account, light green is active lead, blue is members list,
// purple is onboarding"). NOTE: the derivation rules below are a sensible default from the fields
// available on AccountSummary and MUST be confirmed with the business — the exact definition of
// "sold" vs "active" and how leads (a separate entity) appear on the map is an open decision.
export type AccountMapStatus = 'sold' | 'active' | 'member' | 'onboarding' | 'inactive';

export const ACCOUNT_MAP_STATUS_META: Record<AccountMapStatus, { label: string; color: string }> = {
  sold: { label: 'Sold account', color: '#2F9E44' }, // dark green
  active: { label: 'Active', color: '#69DB7C' }, // light green
  member: { label: 'Member', color: '#1971C2' }, // blue
  onboarding: { label: 'Onboarding', color: '#9C36B5' }, // purple
  inactive: { label: 'Inactive', color: '#868E96' }, // gray
};

export const ACCOUNT_MAP_STATUS_ORDER: AccountMapStatus[] = ['sold', 'active', 'member', 'onboarding', 'inactive'];

type DerivableAccount = Pick<AccountSummary, 'lifecycleStatus' | 'consignment' | 'groupClassification' | 'lastOrderAt'>;

export function deriveAccountMapStatus(account: DerivableAccount): AccountMapStatus {
  if (account.lifecycleStatus === 'inactive' || account.lifecycleStatus === 'churned') {
    return 'inactive';
  }
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

export function accountMapColor(account: DerivableAccount): string {
  return ACCOUNT_MAP_STATUS_META[deriveAccountMapStatus(account)].color;
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
