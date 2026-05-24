export type MobileLiveApiSectionKey = 'leads' | 'accounts' | 'lead_queue' | 'consignment_sites' | 'consignment_work';

export type MobileLiveApiSectionInput = {
  count: number;
  key: MobileLiveApiSectionKey;
  label: string;
  result: 'fulfilled' | 'rejected';
};

export type MobileLiveApiSectionState = {
  count: number;
  key: MobileLiveApiSectionKey;
  label: string;
  status: 'loaded' | 'empty' | 'failed';
};

export type MobileLiveApiStatus = {
  emptyCount: number;
  failedCount: number;
  loadedCount: number;
  message: string;
  overall: 'ready' | 'partial' | 'unavailable';
  sections: MobileLiveApiSectionState[];
};

export function summarizeMobileLiveApiStatus(sections: MobileLiveApiSectionInput[]): MobileLiveApiStatus {
  const sectionStates = sections.map((section): MobileLiveApiSectionState => {
    if (section.result === 'rejected') {
      return { ...section, status: 'failed' };
    }
    return { ...section, status: section.count > 0 ? 'loaded' : 'empty' };
  });

  const failedCount = sectionStates.filter((section) => section.status === 'failed').length;
  const loadedCount = sectionStates.filter((section) => section.status === 'loaded').length;
  const emptyCount = sectionStates.filter((section) => section.status === 'empty').length;
  const failedLabels = sectionStates.filter((section) => section.status === 'failed').map((section) => section.label);

  if (failedCount === sectionStates.length) {
    return {
      emptyCount,
      failedCount,
      loadedCount,
      message: 'No live CRM sections refreshed. Keep any field updates in Sync Status and retry when the connection is stable.',
      overall: 'unavailable',
      sections: sectionStates,
    };
  }

  if (failedCount > 0) {
    return {
      emptyCount,
      failedCount,
      loadedCount,
      message: `Partial live CRM data. Failed sections: ${failedLabels.join(', ')}.`,
      overall: 'partial',
      sections: sectionStates,
    };
  }

  return {
    emptyCount,
    failedCount,
    loadedCount,
    message: emptyCount > 0
      ? 'Live CRM connection is working. Some sections are empty for this role or filter.'
      : 'Live CRM connection is working for all mobile dashboard sections.',
    overall: 'ready',
    sections: sectionStates,
  };
}
