import { AuthorizationError } from '@pulse/auth';
import { Prisma, prisma } from '@pulse/db';
import type { AuthenticatedActor } from '../auth/types.js';
import {
  buildAccountRecordScope,
  hasGlobalRecordVisibility,
  resolveLeadRecordScope,
} from '../auth/visibility.js';

function buildTerritoryManagerScope(userId: string): Prisma.TerritoryWhereInput {
  return {
    OR: [
      { managerUserId: userId },
      {
        leads: {
          some: {
            assignedTmUserId: userId,
          },
        },
      },
      {
        accounts: {
          some: {
            assignedTmUserId: userId,
          },
        },
      },
    ],
  };
}

function buildRegionalDirectorScope(userId: string): Prisma.TerritoryWhereInput {
  return {
    OR: [
      {
        region: {
          is: {
            directorUserId: userId,
          },
        },
      },
      {
        leads: {
          some: {
            assignedRdUserId: userId,
          },
        },
      },
      {
        accounts: {
          some: {
            assignedRdUserId: userId,
          },
        },
      },
    ],
  };
}

export function buildTerritoryReadScope(actor: AuthenticatedActor): Prisma.TerritoryWhereInput | undefined {
  if (hasGlobalRecordVisibility(actor.role)) {
    return undefined;
  }

  if (actor.role === 'TERRITORY_MANAGER') {
    return buildTerritoryManagerScope(actor.userId);
  }

  if (actor.role === 'REGIONAL_DIRECTOR') {
    return buildRegionalDirectorScope(actor.userId);
  }

  return {
    id: '__no-territory-scope__',
  };
}

export function buildRegionReadScope(actor: AuthenticatedActor): Prisma.RegionWhereInput | undefined {
  if (hasGlobalRecordVisibility(actor.role)) {
    return undefined;
  }

  if (actor.role === 'TERRITORY_MANAGER') {
    return {
      territories: {
        some: buildTerritoryManagerScope(actor.userId),
      },
    };
  }

  if (actor.role === 'REGIONAL_DIRECTOR') {
    return {
      OR: [
        {
          directorUserId: actor.userId,
        },
        {
          territories: {
            some: buildRegionalDirectorScope(actor.userId),
          },
        },
      ],
    };
  }

  return {
    id: '__no-region-scope__',
  };
}

export async function buildShippingCenterReadScope(
  actor: AuthenticatedActor,
): Promise<Prisma.ShippingCenterWhereInput | undefined> {
  if (hasGlobalRecordVisibility(actor.role)) {
    return undefined;
  }

  const territoryScope = buildTerritoryReadScope(actor);
  const leadScope = await resolveLeadRecordScope(actor);
  const accountScope = buildAccountRecordScope(actor);
  const orClauses: Prisma.ShippingCenterWhereInput[] = [];

  if (territoryScope) {
    orClauses.push({
      territories: {
        some: territoryScope,
      },
    });
  }

  if (leadScope) {
    orClauses.push({
      assignedLeads: {
        some: leadScope,
      },
    });
  }

  if (accountScope) {
    orClauses.push({
      assignedAccounts: {
        some: accountScope,
      },
    });
  }

  if (orClauses.length === 0) {
    return {
      id: '__no-shipping-center-scope__',
    };
  }

  return {
    OR: orClauses,
  };
}

export async function assertTerritoryAssignmentHistoryVisible(
  actor: AuthenticatedActor,
  entityType: 'lead' | 'account' | 'location',
  entityId: string,
) {
  if (hasGlobalRecordVisibility(actor.role)) {
    return;
  }

  if (entityType === 'lead') {
    const leadScope = await resolveLeadRecordScope(actor);
    const visibleLead = await prisma.lead.findFirst({
      where: leadScope
        ? {
            AND: [
              { id: entityId },
              leadScope,
            ],
          }
        : { id: entityId },
      select: { id: true },
    });

    if (!visibleLead) {
      throw new AuthorizationError('Requested lead territory history is outside your visible scope');
    }

    return;
  }

  const accountScope = buildAccountRecordScope(actor);

  if (entityType === 'account') {
    const visibleAccount = await prisma.account.findFirst({
      where: accountScope
        ? {
            AND: [
              { id: entityId },
              accountScope,
            ],
          }
        : { id: entityId },
      select: { id: true },
    });

    if (!visibleAccount) {
      throw new AuthorizationError('Requested account territory history is outside your visible scope');
    }

    return;
  }

  const visibleLocation = await prisma.accountLocation.findFirst({
    where: accountScope
      ? {
          id: entityId,
          account: accountScope,
        }
      : { id: entityId },
    select: { id: true },
  });

  if (!visibleLocation) {
    throw new AuthorizationError('Requested location territory history is outside your visible scope');
  }
}
