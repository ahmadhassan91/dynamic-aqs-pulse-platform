import { LeadWorkspace } from '@/components/leads/LeadWorkspace';

type LeadsPageProps = {
  searchParams: Promise<{
    tab?: 'overview' | 'pipeline' | 'analytics';
  }>;
};

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const { tab } = await searchParams;

  return <LeadWorkspace initialTab={tab ?? 'overview'} />;
}
