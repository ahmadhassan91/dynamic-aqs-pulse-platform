import { ProtectedWorkspace } from '@/components/auth/ProtectedWorkspace';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';

export default function AdminUsersPage() {
  return (
    <ProtectedWorkspace requiredAction="admin.user_view">
      <AdminWorkspace initialTab="users" />
    </ProtectedWorkspace>
  );
}
