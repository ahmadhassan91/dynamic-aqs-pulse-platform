import { LeadRecordWorkspace } from '@/components/leads/LeadRecordWorkspace';

export default async function LeadRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <LeadRecordWorkspace leadId={id} />;
}
