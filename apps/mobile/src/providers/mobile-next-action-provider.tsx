import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useFieldData } from '@/hooks/use-mobile-data';
import { summarizeMobileDraftQueue, useMobileDraftQueue } from '@/lib/mobile-draft-queue';
import { buildMobileNextActionState } from '@/lib/mobile-next-action';

export const mobileNextActionFetchLimit = 20;

export type MobileNextActionContextValue = {
  draftSummary: ReturnType<typeof summarizeMobileDraftQueue>;
  drafts: ReturnType<typeof useMobileDraftQueue>;
  fieldData: ReturnType<typeof useFieldData>;
  nextActions: ReturnType<typeof buildMobileNextActionState>;
};

const MobileNextActionContext = createContext<MobileNextActionContextValue | null>(null);

export function MobileNextActionProvider({ children }: { children: ReactNode }) {
  const fieldData = useFieldData(mobileNextActionFetchLimit, { includeTrainingSignals: true });
  const drafts = useMobileDraftQueue();
  const draftSummary = useMemo(() => summarizeMobileDraftQueue(drafts), [drafts]);
  const nextActions = useMemo(
    () =>
      buildMobileNextActionState({
        consignmentSites: fieldData.consignmentSites,
        consignmentWorkItems: fieldData.consignmentWorkItems,
        draftSummary,
        drafts,
        queueSummary: fieldData.queueSummary,
        trainingDueCount: fieldData.trainingDueCount,
        workflowQueueItems: fieldData.workflowQueueItems,
      }),
    [draftSummary, drafts, fieldData.consignmentSites, fieldData.consignmentWorkItems, fieldData.queueSummary, fieldData.trainingDueCount, fieldData.workflowQueueItems],
  );

  const value = useMemo(
    () => ({
      draftSummary,
      drafts,
      fieldData,
      nextActions,
    }),
    [draftSummary, drafts, fieldData, nextActions],
  );

  return <MobileNextActionContext.Provider value={value}>{children}</MobileNextActionContext.Provider>;
}

export function useMobileNextActions() {
  const context = useContext(MobileNextActionContext);

  if (!context) {
    throw new Error('useMobileNextActions must be used within MobileNextActionProvider');
  }

  return context;
}
