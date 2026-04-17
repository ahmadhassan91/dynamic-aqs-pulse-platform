import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const PRISMA_TRANSACTION_MAX_WAIT_MS = 10_000;
const PRISMA_TRANSACTION_TIMEOUT_MS = 20_000;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    transactionOptions: {
      maxWait: PRISMA_TRANSACTION_MAX_WAIT_MS,
      timeout: PRISMA_TRANSACTION_TIMEOUT_MS,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export * from '@prisma/client';
