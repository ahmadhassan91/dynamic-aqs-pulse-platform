import type { ReactNode } from 'react';
import { ProtectedWorkspace } from '@/components/auth/ProtectedWorkspace';
import { AppLayout } from '@/components/layout/AppLayout';

export default function DigitalAssetsLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedWorkspace requiredModule="digital_assets">
      <AppLayout>
        <div className="residential-content-container">
          {children}
        </div>
      </AppLayout>
    </ProtectedWorkspace>
  );
}

