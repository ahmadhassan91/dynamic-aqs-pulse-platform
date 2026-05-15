import { useCallback, useEffect, useState } from 'react';
import type { AccountSummary } from '@pulse/contracts/accounts';
import type { LeadSummary, LeadWorkflowQueueSummary } from '@pulse/contracts/leads';
import { fetchAccounts, fetchLeads, fetchLeadWorkflowQueue } from '@/lib/api';
import { useSession } from '@/providers/session-provider';

export function useFieldData(limit = 20) {
  const { apiBaseUrl, auth } = useSession();
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [queueSummary, setQueueSummary] = useState<LeadWorkflowQueueSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [leadResponse, accountResponse, queueResponse] = await Promise.all([
        fetchLeads(apiBaseUrl, auth.tokens.accessToken, { limit }),
        fetchAccounts(apiBaseUrl, auth.tokens.accessToken, { limit }),
        fetchLeadWorkflowQueue(apiBaseUrl, auth.tokens.accessToken, { limit }),
      ]);
      setLeads(leadResponse.items);
      setAccounts(accountResponse.items);
      setQueueSummary(queueResponse.summary);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load field data.');
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, auth, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { accounts, errorMessage, isLoading, leads, queueSummary, reload: load };
}
