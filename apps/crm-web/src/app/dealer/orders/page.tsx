'use client';

import { DealerOrderHistory } from '@/components/dealer/DealerOrderHistory';
import { DealerPortalProtectedWorkspace } from '@/components/dealer/DealerPortalProtectedWorkspace';
import { BrandedDealerLayout } from '@/components/layout/BrandedDealerLayout';
import { useDealerPortalDashboard } from '@/lib/use-dealer-portal-dashboard';
import { useDealerPortalOrders } from '@/lib/use-dealer-portal-orders';

export default function DealerOrdersPage() {
  const { dashboard } = useDealerPortalDashboard();
  const { orders, error, isLoading } = useDealerPortalOrders();

  return (
    <DealerPortalProtectedWorkspace>
      <BrandedDealerLayout dashboard={dashboard}>
        <DealerOrderHistory orders={orders} isLoading={isLoading} error={error} />
      </BrandedDealerLayout>
    </DealerPortalProtectedWorkspace>
  );
}
