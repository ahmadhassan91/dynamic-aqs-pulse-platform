import { ProtectedWorkspace } from '@/components/auth/ProtectedWorkspace';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';

type AdminIntegrationsPageProps = {
  searchParams: Promise<{
    provider?: 'entra' | 'calendar' | 'payments' | 'lead-alerts';
  }>;
};

export default async function AdminIntegrationsPage({ searchParams }: AdminIntegrationsPageProps) {
  const { provider } = await searchParams;

  return (
    <ProtectedWorkspace requiredAction="admin.integration_view">
      <AdminWorkspace initialTab="integrations" initialIntegrationProvider={provider ?? 'entra'} />
    </ProtectedWorkspace>
  );
}
