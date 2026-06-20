// Derive overdue ROSE count: sites whose nextAuditDueAt is in the past
export function countOverdueRoseSites(consignmentSites: { nextAuditDueAt?: string }[], now: Date): number {
  return consignmentSites.filter((site) => {
    if (!site.nextAuditDueAt) return false;
    return new Date(site.nextAuditDueAt).getTime() < now.getTime();
  }).length;
}

// FR-MOB-007 / FR-MOB-046 (Q-M-02): the lead inbox must be reachable from Today in <=2 taps and not
// buried under "More". The Today screen renders an always-present shortcut to this route. Kept here as
// a pure, testable constant so the route target + its presence are locked without importing the screen.
// (Tab composition — whether Leads becomes a permanent bottom tab — remains the deferred Q-M-02 call.)
export const TODAY_LEAD_INBOX_HREF = '/leads' as const;
