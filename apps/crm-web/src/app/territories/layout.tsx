import type { ReactNode } from 'react';
import { ProtectedWorkspace } from '@/components/auth/ProtectedWorkspace';
import { AppLayout } from '@/components/layout/AppLayout';

export default function TerritoriesLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedWorkspace requiredModule="territories">
      <AppLayout>
        <div className="residential-content-container">
          {children}
        </div>
      </AppLayout>
    </ProtectedWorkspace>
  );
}
