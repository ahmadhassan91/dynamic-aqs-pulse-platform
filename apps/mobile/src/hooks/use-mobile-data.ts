import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountSummary } from '@pulse/contracts/accounts';
import type { ConsignmentSiteSummary } from '@pulse/contracts/consignment';
import type { LeadSummary, LeadWorkflowQueueItem, LeadWorkflowQueueSummary } from '@pulse/contracts/leads';
import { fetchAccounts, fetchConsignmentOperationalQueue, fetchConsignmentSites, fetchLeads, fetchLeadWorkflowQueue, fetchTrainingSessions } from '@/lib/api';
import { summarizeMobileLiveApiStatus, type MobileLiveApiSectionInput, type MobileLiveApiStatus } from '@/lib/mobile-live-api-status';
import { isMobileActionableTrainingSession } from '@/lib/training-mobile-policy';
import { useSession } from '@/providers/session-provider';

export type UseFieldDataOptions = {
  includeTrainingSignals?: boolean;
};

export function useFieldData(limit = 20, options: UseFieldDataOptions = {}) {
  const { apiBaseUrl, auth } = useSession();
  const includeTrainingSignals = Boolean(options.includeTrainingSignals);
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [consignmentSites, setConsignmentSites] = useState<ConsignmentSiteSummary[]>([]);
  const [consignmentWorkItems, setConsignmentWorkItems] = useState<ConsignmentSiteSummary[]>([]);
  const [workflowQueueItems, setWorkflowQueueItems] = useState<LeadWorkflowQueueItem[]>([]);
  const [queueSummary, setQueueSummary] = useState<LeadWorkflowQueueSummary | null>(null);
  const [trainingDueCount, setTrainingDueCount] = useState(0);
  const [liveApiStatus, setLiveApiStatus] = useState<MobileLiveApiStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const clearData = useCallback(() => {
    setLeads([]);
    setAccounts([]);
    setConsignmentSites([]);
    setConsignmentWorkItems([]);
    setWorkflowQueueItems([]);
    setQueueSummary(null);
    setTrainingDueCount(0);
    setLiveApiStatus(null);
    setErrorMessage(null);
    setIsLoading(false);
  }, []);

  const load = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!auth) {
      clearData();
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const accessToken = auth.tokens.accessToken;
    const [leadResponse, accountResponse, queueResponse, consignmentResponse, consignmentOpsResponse, trainingResponse] = await Promise.allSettled([
      fetchLeads(apiBaseUrl, accessToken, { limit }),
      fetchAccounts(apiBaseUrl, accessToken, { limit }),
      fetchLeadWorkflowQueue(apiBaseUrl, accessToken, { limit }),
      fetchConsignmentSites(apiBaseUrl, accessToken, { dueWithinDays: 45, includeExited: false, limit }),
      fetchConsignmentOperationalQueue(apiBaseUrl, accessToken, { limit }),
      includeTrainingSignals
        ? fetchTrainingSessions(apiBaseUrl, accessToken, { includeVisits: false, limit, status: 'all' })
        : Promise.resolve(null),
    ]);

    if (requestIdRef.current !== requestId) return;

    if (leadResponse.status === 'fulfilled') setLeads(leadResponse.value.items);
    if (accountResponse.status === 'fulfilled') setAccounts(accountResponse.value.items);
    if (queueResponse.status === 'fulfilled') {
      setQueueSummary(queueResponse.value.summary);
      setWorkflowQueueItems(queueResponse.value.items);
    }
    if (consignmentResponse.status === 'fulfilled') setConsignmentSites(consignmentResponse.value.items);
    if (consignmentOpsResponse.status === 'fulfilled') setConsignmentWorkItems(consignmentOpsResponse.value.items);
    if (trainingResponse.status === 'fulfilled') {
      setTrainingDueCount(trainingResponse.value ? trainingResponse.value.items.filter(isMobileActionableTrainingSession).length : 0);
    }

    const liveApiSections: MobileLiveApiSectionInput[] = [
      { key: 'leads', label: 'Leads', result: leadResponse.status, count: leadResponse.status === 'fulfilled' ? leadResponse.value.items.length : 0 },
      { key: 'accounts', label: 'Accounts', result: accountResponse.status, count: accountResponse.status === 'fulfilled' ? accountResponse.value.items.length : 0 },
      { key: 'lead_queue', label: 'Lead queue', result: queueResponse.status, count: queueResponse.status === 'fulfilled' ? queueResponse.value.items.length : 0 },
      { key: 'consignment_sites', label: 'Consignment sites', result: consignmentResponse.status, count: consignmentResponse.status === 'fulfilled' ? consignmentResponse.value.items.length : 0 },
      { key: 'consignment_work', label: 'Consignment work', result: consignmentOpsResponse.status, count: consignmentOpsResponse.status === 'fulfilled' ? consignmentOpsResponse.value.items.length : 0 },
    ];
    if (includeTrainingSignals) {
      liveApiSections.push({
        key: 'training_sessions',
        label: 'Training sessions',
        result: trainingResponse.status,
        count: trainingResponse.status === 'fulfilled' && trainingResponse.value ? trainingResponse.value.items.filter(isMobileActionableTrainingSession).length : 0,
      });
    }
    const nextLiveApiStatus = summarizeMobileLiveApiStatus(liveApiSections);
    setLiveApiStatus(nextLiveApiStatus);

    const failedSections = [
      leadResponse.status === 'rejected' ? 'leads' : null,
      accountResponse.status === 'rejected' ? 'accounts' : null,
      queueResponse.status === 'rejected' ? 'lead queue' : null,
      consignmentResponse.status === 'rejected' ? 'consignment sites' : null,
      consignmentOpsResponse.status === 'rejected' ? 'consignment work' : null,
      includeTrainingSignals && trainingResponse.status === 'rejected' ? 'training sessions' : null,
    ].filter(Boolean);
    if (failedSections.length) {
      setErrorMessage(`Some CRM data could not refresh: ${failedSections.join(', ')}. Available sections are still shown.`);
    }
    setIsLoading(false);
  }, [apiBaseUrl, auth, clearData, includeTrainingSignals, limit]);

  useEffect(() => {
    void load();

    return () => {
      requestIdRef.current += 1;
    };
  }, [load]);

  return { accounts, consignmentSites, consignmentWorkItems, errorMessage, isLoading, leads, liveApiStatus, queueSummary, reload: load, trainingDueCount, workflowQueueItems };
}
