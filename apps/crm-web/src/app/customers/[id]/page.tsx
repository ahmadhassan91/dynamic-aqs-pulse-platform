import { CustomerDetail } from '@/components/customers/CustomerDetail';

type CustomerDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;

  return <CustomerDetail accountId={id} />;
}
