import { CisPublicForm } from '@/components/cis/CisPublicForm';

type CisPublicAliasPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function CisPublicAliasPage({ params }: CisPublicAliasPageProps) {
  const { token } = await params;

  return <CisPublicForm token={token} />;
}
