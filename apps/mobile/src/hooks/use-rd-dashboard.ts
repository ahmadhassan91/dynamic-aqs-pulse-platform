import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchConsignmentSites, fetchLeadDashboard, fetchTrainingDashboard } from '@/lib/api';
import { deriveRdDashboardSummary, type RdDashboardSummary } from '@/lib/rd-dashboard-metrics';
import { useSession } from '@/providers/session-provider';

// FR-MOB-058 — loads the RD rollup from the role-scoped reporting endpoints + the consignment sites the
// field already uses. Partial-failure tolerant (Promise.allSettled), with a stale-response guard.
export function useRdDashboard() {
  const { apiBaseUrl, auth } = useSession();
  const [summary, setSummary] = useState<RdDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!auth) {
      setSummary(null);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    const accessToken = auth.tokens.accessToken;
    const [leadRes, trainingRes, consignRes] = await Promise.allSettled([
      fetchLeadDashboard(apiBaseUrl, accessToken),
      fetchTrainingDashboard(apiBaseUrl, accessToken),
      fetchConsignmentSites(apiBaseUrl, accessToken, { dueWithinDays: 45, includeExited: false, limit: 200 }),
    ]);

    if (requestIdRef.current !== requestId) return;

    const lead = leadRes.status === 'fulfilled' ? leadRes.value : null;
    const training = trainingRes.status === 'fulfilled' ? trainingRes.value : null;
    const consignmentSites = consignRes.status === 'fulfilled' ? consignRes.value.items : [];
    setSummary(deriveRdDashboardSummary({ lead, training, consignmentSites, now: new Date() }));

    const failed = [
      leadRes.status === 'rejected' ? 'leads' : null,
      trainingRes.status === 'rejected' ? 'training' : null,
      consignRes.status === 'rejected' ? 'consignment' : null,
    ].filter(Boolean);
    setErrorMessage(failed.length ? `Some director metrics could not refresh: ${failed.join(', ')}. Available sections are still shown.` : null);
    setIsLoading(false);
  }, [apiBaseUrl, auth]);

  useEffect(() => {
    void load();
    return () => {
      requestIdRef.current += 1;
    };
  }, [load]);

  return { summary, isLoading, errorMessage, reload: load };
}
