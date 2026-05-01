import type { ReactNode } from 'react';
import { ProtectedWorkspace } from '@/components/auth/ProtectedWorkspace';
import { AppLayout } from '@/components/layout/AppLayout';

export default function ProductManagementLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedWorkspace requiredModule="product_management">
      <AppLayout>
        <div className="residential-content-container">
          {children}
        </div>
      </AppLayout>
    </ProtectedWorkspace>
  );
}

