import { useCallback, useEffect, useState } from 'react';
import type { AccountSummary } from '@pulse/contracts/accounts';
import type { ConsignmentSiteSummary } from '@pulse/contracts/consignment';
import type { LeadSummary, LeadWorkflowQueueSummary } from '@pulse/contracts/leads';
import { fetchAccounts, fetchConsignmentOperationalQueue, fetchConsignmentSites, fetchLeads, fetchLeadWorkflowQueue } from '@/lib/api';
import { useSession } from '@/providers/session-provider';

export function useFieldData(limit = 20) {
  const { apiBaseUrl, auth } = useSession();
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [consignmentSites, setConsignmentSites] = useState<ConsignmentSiteSummary[]>([]);
  const [consignmentWorkItems, setConsignmentWorkItems] = useState<ConsignmentSiteSummary[]>([]);
  const [queueSummary, setQueueSummary] = useState<LeadWorkflowQueueSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth) return;
    setIsLoading(true);
    setErrorMessage(null);
    const [leadResponse, accountResponse, queueResponse, consignmentResponse, consignmentOpsResponse] = await Promise.allSettled([
      fetchLeads(apiBaseUrl, auth.tokens.accessToken, { limit }),
      fetchAccounts(apiBaseUrl, auth.tokens.accessToken, { limit }),
      fetchLeadWorkflowQueue(apiBaseUrl, auth.tokens.accessToken, { limit }),
      fetchConsignmentSites(apiBaseUrl, auth.tokens.accessToken, { dueWithinDays: 45, includeExited: false, limit }),
      fetchConsignmentOperationalQueue(apiBaseUrl, auth.tokens.accessToken, { limit }),
    ]);

    if (leadResponse.status === 'fulfilled') setLeads(leadResponse.value.items);
    if (accountResponse.status === 'fulfilled') setAccounts(accountResponse.value.items);
    if (queueResponse.status === 'fulfilled') setQueueSummary(queueResponse.value.summary);
    if (consignmentResponse.status === 'fulfilled') setConsignmentSites(consignmentResponse.value.items);
    if (consignmentOpsResponse.status === 'fulfilled') setConsignmentWorkItems(consignmentOpsResponse.value.items);

    const failedSections = [
      leadResponse.status === 'rejected' ? 'leads' : null,
      accountResponse.status === 'rejected' ? 'accounts' : null,
      queueResponse.status === 'rejected' ? 'lead queue' : null,
      consignmentResponse.status === 'rejected' ? 'consignment sites' : null,
      consignmentOpsResponse.status === 'rejected' ? 'consignment work' : null,
    ].filter(Boolean);
    if (failedSections.length) {
      setErrorMessage(`Some CRM data could not refresh: ${failedSections.join(', ')}. Available sections are still shown.`);
    }
    setIsLoading(false);
  }, [apiBaseUrl, auth, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { accounts, consignmentSites, consignmentWorkItems, errorMessage, isLoading, leads, queueSummary, reload: load };
}
