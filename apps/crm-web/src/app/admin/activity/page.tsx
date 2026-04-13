import { ProtectedWorkspace } from '@/components/auth/ProtectedWorkspace';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';

export default function AdminActivityPage() {
  return (
    <ProtectedWorkspace requiredAction="admin.audit_view">
      <AdminWorkspace initialTab="activity" />
    </ProtectedWorkspace>
  );
}
