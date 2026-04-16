import { ProtectedWorkspace } from '@/components/auth/ProtectedWorkspace';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';

type AdminPageProps = {
  searchParams: Promise<{
    tab?: 'overview' | 'users' | 'roles' | 'activity' | 'integrations';
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { tab } = await searchParams;

  return (
    <ProtectedWorkspace requiredAction="admin.user_view">
      <AdminWorkspace initialTab={tab ?? 'overview'} />
    </ProtectedWorkspace>
  );
}
