import { LeadWorkspace, type LeadWorkspaceTab } from '@/components/leads/LeadWorkspace';

type LeadTabQuery = 'overview' | 'pipeline' | 'queue' | 'analytics' | 'insights';

type LeadsPageProps = {
  searchParams: Promise<{
    tab?: LeadTabQuery;
  }>;
};

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const { tab } = await searchParams;

  return <LeadWorkspace initialTab={resolveLeadTab(tab)} />;
}

function resolveLeadTab(tab: LeadTabQuery | undefined): LeadWorkspaceTab {
  if (tab === 'analytics' || tab === 'insights') {
    return 'insights';
  }

  return 'queue';
}
