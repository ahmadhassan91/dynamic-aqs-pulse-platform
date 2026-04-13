import { PublicWebsiteLeadCaptureForm } from '@/components/leads/PublicWebsiteLeadCaptureForm';

type PageProps = {
  params: Promise<{
    siteId: string;
  }>;
};

export default async function PublicWebsiteLeadCapturePage({ params }: PageProps) {
  const { siteId } = await params;
  return <PublicWebsiteLeadCaptureForm siteId={siteId} />;
}
