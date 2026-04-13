import { CisPublicForm } from '@/components/cis/CisPublicForm';

type CisPublicPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function CisPublicPage({ params }: CisPublicPageProps) {
  const { token } = await params;

  return <CisPublicForm token={token} />;
}
