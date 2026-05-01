import { ProductDetailWorkspace } from '@/components/product-management/ProductDetailWorkspace';

export default async function ProductManagementProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  return <ProductDetailWorkspace productId={productId} />;
}

