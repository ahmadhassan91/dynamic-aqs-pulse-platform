'use client';

import { Box } from '@mantine/core';
import Link from 'next/link';
import { PulseLogo } from './PulseLogo';
import { getDefaultWorkspacePath } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';

export function Logo() {
  const { auth } = usePulseSession();

  return (
    <Link href={getDefaultWorkspacePath(auth?.identity.role)} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Box style={{ transform: 'scale(1.04)', transformOrigin: 'left center' }}>
        <PulseLogo />
      </Box>
    </Link>
  );
}
