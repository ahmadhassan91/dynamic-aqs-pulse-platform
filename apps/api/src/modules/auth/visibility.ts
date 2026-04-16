import type { AuthRole } from '@pulse/contracts';
import type { Prisma } from '@pulse/db';
import type { AuthenticatedActor } from './types.js';

const GLOBAL_RECORD_SCOPE_ROLES = new Set<AuthRole>([
  'SUPER_ADMIN',
  'EXECUTIVE',
  'SALES_BD_REP',
  'SALES_BD_LEADERSHIP',
  'FINANCE',
  'ADMIN_CSR_OPS',
  'TRAINING_OPS',
]);

export function hasGlobalRecordVisibility(role: AuthRole) {
  return GLOBAL_RECORD_SCOPE_ROLES.has(role);
}

export function buildLeadRecordScope(actor: AuthenticatedActor): Prisma.LeadWhereInput | undefined {
  if (hasGlobalRecordVisibility(actor.role)) {
    return undefined;
  }

  if (actor.role === 'TERRITORY_MANAGER') {
    return {
      OR: [
        { assignedTmUserId: actor.userId },
        {
          territory: {
            is: {
              managerUserId: actor.userId,
            },
          },
        },
      ],
    };
  }

  if (actor.role === 'REGIONAL_DIRECTOR') {
    return {
      OR: [
        { assignedRdUserId: actor.userId },
        {
          territory: {
            is: {
              region: {
                is: {
                  directorUserId: actor.userId,
                },
              },
            },
          },
        },
      ],
    };
  }

  return {
    id: '__no-record-scope__',
  };
}

export function buildAccountRecordScope(actor: AuthenticatedActor): Prisma.AccountWhereInput | undefined {
  if (hasGlobalRecordVisibility(actor.role)) {
    return undefined;
  }

  if (actor.role === 'TERRITORY_MANAGER') {
    return {
      OR: [
        { assignedTmUserId: actor.userId },
        {
          territory: {
            is: {
              managerUserId: actor.userId,
            },
          },
        },
      ],
    };
  }

  if (actor.role === 'REGIONAL_DIRECTOR') {
    return {
      OR: [
        { assignedRdUserId: actor.userId },
        {
          territory: {
            is: {
              region: {
                is: {
                  directorUserId: actor.userId,
                },
              },
            },
          },
        },
      ],
    };
  }

  return {
    id: '__no-record-scope__',
  };
}

export function buildTrainingSessionRecordScope(actor: AuthenticatedActor): Prisma.TrainingSessionWhereInput | undefined {
  if (hasGlobalRecordVisibility(actor.role)) {
    return undefined;
  }

  if (actor.role === 'TERRITORY_MANAGER') {
    return {
      OR: [
        {
          account: {
            assignedTmUserId: actor.userId,
          },
        },
        {
          account: {
            territory: {
              is: {
                managerUserId: actor.userId,
              },
            },
          },
        },
      ],
    };
  }

  if (actor.role === 'REGIONAL_DIRECTOR') {
    return {
      OR: [
        {
          account: {
            assignedRdUserId: actor.userId,
          },
        },
        {
          account: {
            territory: {
              is: {
                region: {
                  is: {
                    directorUserId: actor.userId,
                  },
                },
              },
            },
          },
        },
      ],
    };
  }

  return {
    id: '__no-record-scope__',
  };
}
