import { ProtectedWorkspace } from '@/components/auth/ProtectedWorkspace';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';

export default function AdminRolesPage() {
  return (
    <ProtectedWorkspace requiredAction="admin.role_view">
      <AdminWorkspace initialTab="roles" />
    </ProtectedWorkspace>
  );
}
