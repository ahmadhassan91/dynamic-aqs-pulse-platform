// Derive overdue ROSE count: sites whose nextAuditDueAt is in the past
export function countOverdueRoseSites(consignmentSites: { nextAuditDueAt?: string }[], now: Date): number {
  return consignmentSites.filter((site) => {
    if (!site.nextAuditDueAt) return false;
    return new Date(site.nextAuditDueAt).getTime() < now.getTime();
  }).length;
}
