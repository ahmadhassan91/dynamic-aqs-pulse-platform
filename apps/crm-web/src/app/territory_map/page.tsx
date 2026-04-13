import { ProtectedWorkspace } from '@/components/auth/ProtectedWorkspace';
import { AppLayout } from '@/components/layout/AppLayout';
import { TerritoryCoverageMapPage } from '@/components/territories/TerritoryCoverageMapPage';

export default function TerritoryMapPage() {
  return (
    <ProtectedWorkspace requiredModule="territories">
      <AppLayout>
        <div className="residential-content-container">
          <TerritoryCoverageMapPage />
        </div>
      </AppLayout>
    </ProtectedWorkspace>
  );
}
