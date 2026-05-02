import { ProtectedWorkspace } from '@/components/auth/ProtectedWorkspace';
import { AdminCatalogRulesWorkspace } from '@/components/admin/AdminCatalogRulesWorkspace';

export default function AdminCatalogRulesPage() {
  return (
    <ProtectedWorkspace requiredAction="product.manage">
      <AdminCatalogRulesWorkspace />
    </ProtectedWorkspace>
  );
}
