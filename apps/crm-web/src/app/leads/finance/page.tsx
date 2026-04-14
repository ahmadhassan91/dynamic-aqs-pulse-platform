import { ProtectedWorkspace } from '@/components/auth/ProtectedWorkspace';
import { LeadFinanceQueue } from '@/components/leads/LeadFinanceQueue';

export default function LeadFinancePage() {
  return (
    <ProtectedWorkspace requiredAction="lead.finance_queue_view">
      <LeadFinanceQueue />
    </ProtectedWorkspace>
  );
}
