'use client';

import { DealerCart } from '@/components/dealer/DealerCart';
import { DealerPortalProtectedWorkspace } from '@/components/dealer/DealerPortalProtectedWorkspace';
import { BrandedDealerLayout } from '@/components/layout/BrandedDealerLayout';
import { useDealerPortalCart } from '@/lib/use-dealer-portal-cart';
import { useDealerPortalDashboard } from '@/lib/use-dealer-portal-dashboard';

export default function DealerCartPage() {
  const { dashboard } = useDealerPortalDashboard();
  const { cart, error, isLoading, removeItem, submit, updateItem } = useDealerPortalCart();

  return (
    <DealerPortalProtectedWorkspace>
      <BrandedDealerLayout dashboard={dashboard}>
        <DealerCart
          cart={cart}
          dashboard={dashboard}
          isLoading={isLoading}
          error={error}
          updateItem={updateItem}
          removeItem={removeItem}
          submit={submit}
        />
      </BrandedDealerLayout>
    </DealerPortalProtectedWorkspace>
  );
}
