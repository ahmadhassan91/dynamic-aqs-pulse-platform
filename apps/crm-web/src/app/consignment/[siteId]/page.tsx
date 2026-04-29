import { ConsignmentSiteDetail } from '@/components/consignment/ConsignmentSiteDetail';

type ConsignmentSitePageProps = {
  params: Promise<{
    siteId: string;
  }>;
};

export default async function ConsignmentSitePage({ params }: ConsignmentSitePageProps) {
  const { siteId } = await params;

  return <ConsignmentSiteDetail siteId={siteId} />;
}
