import type { AuthRole } from '@pulse/contracts';
import { LeadStage, TerritoryAssignmentMethod, prisma, type Prisma } from '@pulse/db';
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

export async function resolveLeadRecordScope(actor: AuthenticatedActor): Promise<Prisma.LeadWhereInput | undefined> {
  const preHandoffTmVisibility = actor.role === 'TERRITORY_MANAGER'
    ? (await prisma.territoryPolicy.findUnique({
      where: { id: 'default' },
      select: { preHandoffTmVisibility: true },
    }))?.preHandoffTmVisibility ?? false
    : false;

  return buildLeadRecordScope(actor, { preHandoffTmVisibility });
}

export function buildLeadRecordScope(
  actor: AuthenticatedActor,
  options?: {
    preHandoffTmVisibility?: boolean;
  },
): Prisma.LeadWhereInput | undefined {
  if (hasGlobalRecordVisibility(actor.role)) {
    return undefined;
  }

  if (actor.role === 'TERRITORY_MANAGER') {
    const visibilityGate = options?.preHandoffTmVisibility
      ? undefined
      : {
          OR: [
            { stage: LeadStage.CUSTOMER_ACTIVE },
            { territoryAssignmentMethod: TerritoryAssignmentMethod.MANUAL_OVERRIDE },
          ],
        } satisfies Prisma.LeadWhereInput;

    return {
      AND: [
        ...(visibilityGate ? [visibilityGate] : []),
        {
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

export function buildOrderDraftRecordScope(actor: AuthenticatedActor): Prisma.OrderDraftWhereInput | undefined {
  if (hasGlobalRecordVisibility(actor.role)) {
    return undefined;
  }

  // Scoped roles (TM/RD) see order drafts for accounts in their book, plus any
  // draft they personally captured (so a creator never loses sight of their own
  // intent even if the account is later reassigned out of their book).
  const accountScope = buildAccountRecordScope(actor);
  return {
    OR: [
      ...(accountScope ? [{ account: { is: accountScope } }] : []),
      { createdByUserId: actor.userId },
    ],
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
