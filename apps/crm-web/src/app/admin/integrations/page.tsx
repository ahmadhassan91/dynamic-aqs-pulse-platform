import { ProtectedWorkspace } from '@/components/auth/ProtectedWorkspace';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';

export default function AdminIntegrationsPage() {
  return (
    <ProtectedWorkspace requiredAction="admin.integration_view">
      <AdminWorkspace initialTab="integrations" />
    </ProtectedWorkspace>
  );
}
