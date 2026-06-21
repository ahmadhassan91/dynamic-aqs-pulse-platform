import type { AuthRole } from '@pulse/contracts';
import { LeadStage, TerritoryAssignmentMethod, prisma, Prisma } from '@pulse/db';
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

// SQL mirror of buildLeadRecordScope, for raw aggregation queries (e.g. the dashboard stage-aging
// rollup) that cannot use a Prisma where object. MUST stay in lockstep with buildLeadRecordScope above —
// parity is enforced by apps/api/test/leads.record-scope-sql.regression.test.mjs. Expects these table
// aliases in the surrounding query: l = "Lead", t = "Territory" (LEFT JOIN ON t.id = l."territoryId"),
// r = "Region" (LEFT JOIN ON r.id = t."regionId").
export function buildLeadRecordScopeSql(
  actor: AuthenticatedActor,
  options?: {
    preHandoffTmVisibility?: boolean;
  },
): Prisma.Sql {
  if (hasGlobalRecordVisibility(actor.role)) {
    return Prisma.sql`TRUE`;
  }

  if (actor.role === 'TERRITORY_MANAGER') {
    const ownership = Prisma.sql`(l."assignedTmUserId" = ${actor.userId}::uuid OR t."managerUserId" = ${actor.userId}::uuid)`;
    if (options?.preHandoffTmVisibility) {
      return ownership;
    }
    return Prisma.sql`(l."stage" = 'CUSTOMER_ACTIVE' OR l."territoryAssignmentMethod" = 'MANUAL_OVERRIDE') AND ${ownership}`;
  }

  if (actor.role === 'REGIONAL_DIRECTOR') {
    return Prisma.sql`(l."assignedRdUserId" = ${actor.userId}::uuid OR r."directorUserId" = ${actor.userId}::uuid)`;
  }

  return Prisma.sql`FALSE`;
}

export async function resolveLeadRecordScopeSql(actor: AuthenticatedActor): Promise<Prisma.Sql> {
  const preHandoffTmVisibility = actor.role === 'TERRITORY_MANAGER'
    ? (await prisma.territoryPolicy.findUnique({
      where: { id: 'default' },
      select: { preHandoffTmVisibility: true },
    }))?.preHandoffTmVisibility ?? false
    : false;

  return buildLeadRecordScopeSql(actor, { preHandoffTmVisibility });
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

export function buildTerritoryRecordScope(actor: AuthenticatedActor): Prisma.TerritoryWhereInput | undefined {
  if (hasGlobalRecordVisibility(actor.role)) {
    return undefined;
  }

  if (actor.role === 'TERRITORY_MANAGER') {
    return { managerUserId: actor.userId };
  }

  if (actor.role === 'REGIONAL_DIRECTOR') {
    return {
      OR: [
        { managerUserId: actor.userId },
        { region: { is: { directorUserId: actor.userId } } },
      ],
    };
  }

  return {
    id: '__no-record-scope__',
  };
}

export function buildConsignmentSiteRecordScope(actor: AuthenticatedActor): Prisma.ConsignmentSiteWhereInput | undefined {
  if (hasGlobalRecordVisibility(actor.role)) {
    return undefined;
  }

  // Mirrors the consignment module's own siteScopeWhere (owner-based), so report
  // visibility matches what the actor sees in the Consignment workspace.
  if (actor.role === 'TERRITORY_MANAGER') {
    return { ownerTmUserId: actor.userId };
  }

  if (actor.role === 'REGIONAL_DIRECTOR') {
    return {
      OR: [
        { ownerRdUserId: actor.userId },
        { region: { is: { directorUserId: actor.userId } } },
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
