import Link from 'next/link';
import { Breadcrumbs, Stack, Text } from '@mantine/core';
import FieldActivityReview from '@/components/customers/FieldActivityReview';

export default function FieldActivityReviewPage() {
  return (
    <Stack gap="md">
      <Breadcrumbs>
        <Link href="/customers" style={{ color: 'var(--mantine-color-blue-6)', textDecoration: 'none' }}>
          Account Management
        </Link>
        <Text>Field Activity Review</Text>
      </Breadcrumbs>
      <FieldActivityReview />
    </Stack>
  );
}
