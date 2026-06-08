/**
 * Compile-time type assertions for Sprint-2/3 contract shapes.
 * No runtime code — only `satisfies`, `as const`, and @ts-expect-error checks.
 */

import type {
  LogLeadActivityNoteRequest,
  LogLeadActivityNoteResponse,
  ListLeadsRequest,
  TransitionLeadStageRequest,
} from '../src/leads.js';

import type {
  ACCOUNT_LOCATION_TYPES,
  AccountLocationTypeKey,
  AccountLocationSummary,
  CreateAccountLocationRequest,
  UpdateAccountLocationRequest,
  ListAccountsRequest,
} from '../src/accounts.js';

import type {
  CreateAdminUserRequest,
} from '../src/admin.js';

// ---------------------------------------------------------------------------
// 1. LogLeadActivityNoteRequest — `note` required, `title` optional
// ---------------------------------------------------------------------------

// Valid: only required field
const _noteReqMinimal: LogLeadActivityNoteRequest = {
  note: 'Spoke with contact via phone.',
};

// Valid: both fields present
const _noteReqFull: LogLeadActivityNoteRequest = {
  note: 'Follow-up scheduled.',
  title: 'Phone call',
};

// Invalid: missing required `note`
// @ts-expect-error — `note` is required
const _noteReqMissingNote: LogLeadActivityNoteRequest = {
  title: 'Some title',
};

// Invalid: `note` cannot be a number
const _noteReqWrongType: LogLeadActivityNoteRequest = {
  // @ts-expect-error — `note` must be string
  note: 42,
};

// ---------------------------------------------------------------------------
// 2. LogLeadActivityNoteResponse — all shape fields must be present
// ---------------------------------------------------------------------------

const _noteRes: LogLeadActivityNoteResponse = {
  id: 'abc123',
  leadId: 'lead-1',
  note: 'Test note',
  title: 'Note title',
  createdAt: '2026-06-08T00:00:00Z',
};

// `createdByName` is optional — can be omitted (exactOptionalPropertyTypes: omit entirely, don't pass undefined)
const _noteResWithActor: LogLeadActivityNoteResponse = {
  id: 'abc123',
  leadId: 'lead-1',
  note: 'Test note',
  title: 'Note title',
  createdByName: 'Ahmad Hassan',
  createdAt: '2026-06-08T00:00:00Z',
};

// Invalid: passing explicit `undefined` to optional prop is disallowed under exactOptionalPropertyTypes
// @ts-expect-error — cannot assign `undefined` to optional `createdByName` under exactOptionalPropertyTypes
const _noteResExplicitUndefined: LogLeadActivityNoteResponse = {
  id: 'abc123',
  leadId: 'lead-1',
  note: 'Test note',
  title: 'Note title',
  createdByName: undefined,
  createdAt: '2026-06-08T00:00:00Z',
};

// ---------------------------------------------------------------------------
// 3. ListLeadsRequest — Sprint-2 filter fields
// ---------------------------------------------------------------------------

// Valid: minimal (all optional)
const _listLeadsEmpty: ListLeadsRequest = {};

// Valid: page (UX-L-013)
const _listLeadsPage: ListLeadsRequest = { page: 0 };
const _listLeadsPageTwo: ListLeadsRequest = { page: 2 };

// Valid: affinityGroupCode filter (UX-L-014)
const _listLeadsAffinity: ListLeadsRequest = { affinityGroupCode: 'GRP-A' };

// Valid: ownershipGroupCode filter (UX-L-014)
const _listLeadsOwnership: ListLeadsRequest = { ownershipGroupCode: 'OWN-B' };

// Valid: territoryId filter (UX-L-014)
const _listLeadsTerritory: ListLeadsRequest = { territoryId: 'terr-uuid-1' };

// Valid: all Sprint-2 filters combined
const _listLeadsAllFilters: ListLeadsRequest = {
  affinityGroupCode: 'GRP-A',
  ownershipGroupCode: 'OWN-B',
  territoryId: 'terr-uuid-1',
  page: 1,
};

// Invalid: `page` must be number, not string
// @ts-expect-error — `page` must be number
const _listLeadsPageWrongType: ListLeadsRequest = { page: 'one' };

// Invalid: unknown property
// @ts-expect-error — `unknownFilter` is not on ListLeadsRequest
const _listLeadsUnknown: ListLeadsRequest = { unknownFilter: 'x' };

// ---------------------------------------------------------------------------
// 4. TransitionLeadStageRequest — `backwardReason` optional (UX-L-011 BR-L-07)
// ---------------------------------------------------------------------------

// Valid: forward transition (no backwardReason needed)
const _transitionForward: TransitionLeadStageRequest = {
  toStage: 'discovery_scheduled',
};

// Valid: backward transition with reason
const _transitionBackward: TransitionLeadStageRequest = {
  toStage: 'new',
  backwardReason: 'Re-qualification required.',
};

// Valid: all fields including note
const _transitionFull: TransitionLeadStageRequest = {
  toStage: 'discovery_completed',
  note: 'Completed discovery session.',
  backwardReason: 'N/A',
};

// Invalid: `toStage` must be a LeadStageKey literal, not arbitrary string
const _transitionBadStage: TransitionLeadStageRequest = {
  // @ts-expect-error — 'invalid_stage' is not a valid LeadStageKey
  toStage: 'invalid_stage',
};

// ---------------------------------------------------------------------------
// 5. ACCOUNT_LOCATION_TYPES constant + AccountLocationTypeKey
// ---------------------------------------------------------------------------

// The constant is a readonly tuple — verify it exists and has the expected type
const _locationTypesTuple = ['billing', 'shipping', 'both', 'other'] as const satisfies typeof ACCOUNT_LOCATION_TYPES;

// Valid key assignments
const _lt1: AccountLocationTypeKey = 'billing';
const _lt2: AccountLocationTypeKey = 'shipping';
const _lt3: AccountLocationTypeKey = 'both';
const _lt4: AccountLocationTypeKey = 'other';

// Invalid: not a member of the union
// @ts-expect-error — 'warehouse' is not an AccountLocationTypeKey
const _ltBad: AccountLocationTypeKey = 'warehouse';

// ---------------------------------------------------------------------------
// 6. AccountLocationSummary — `locationType` optional (UX-A-012)
// ---------------------------------------------------------------------------

// Valid: locationType omitted
const _locationSummaryNoType: AccountLocationSummary = {
  id: 'loc-1',
  isPrimary: true,
  isActive: true,
};

// Valid: locationType present with a valid value
const _locationSummaryWithType: AccountLocationSummary = {
  id: 'loc-1',
  isPrimary: true,
  isActive: true,
  locationType: 'billing',
};

// Invalid: locationType with wrong literal
const _locationSummaryBadType: AccountLocationSummary = {
  id: 'loc-1',
  isPrimary: true,
  isActive: true,
  // @ts-expect-error — 'warehouse' is not AccountLocationTypeKey
  locationType: 'warehouse',
};

// ---------------------------------------------------------------------------
// 7. CreateAccountLocationRequest — `locationType` optional (UX-A-012)
// ---------------------------------------------------------------------------

// Valid: minimal
const _createLocMinimal: CreateAccountLocationRequest = {};

// Valid: with locationType
const _createLocWithType: CreateAccountLocationRequest = {
  locationType: 'shipping',
};

// Valid: all fields
const _createLocFull: CreateAccountLocationRequest = {
  locationCode: 'MAIN',
  name: 'Head Office',
  line1: '123 Main St',
  city: 'Austin',
  state: 'TX',
  postalCode: '78701',
  countryCode: 'US',
  isPrimary: true,
  isActive: true,
  locationType: 'both',
};

// Invalid: wrong locationType value
const _createLocBadType: CreateAccountLocationRequest = {
  // @ts-expect-error — 'depot' is not AccountLocationTypeKey
  locationType: 'depot',
};

// ---------------------------------------------------------------------------
// 8. UpdateAccountLocationRequest — `locationType` optional and nullable (AccountLocationTypeKey | null)
// ---------------------------------------------------------------------------

// Valid: set to null (clear the value)
const _updateLocClear: UpdateAccountLocationRequest = {
  locationType: null,
};

// Valid: set to a valid key
const _updateLocSet: UpdateAccountLocationRequest = {
  locationType: 'other',
};

// Valid: omit locationType entirely
const _updateLocOmit: UpdateAccountLocationRequest = {};

// Invalid: wrong value
const _updateLocBad: UpdateAccountLocationRequest = {
  // @ts-expect-error — 'loading_dock' is not AccountLocationTypeKey | null
  locationType: 'loading_dock',
};

// ---------------------------------------------------------------------------
// 9. ListAccountsRequest.offset — UX-A-010 offset-based pagination
// ---------------------------------------------------------------------------

// Valid: offset present
const _listAccountsWithOffset: ListAccountsRequest = { offset: 0 };
const _listAccountsOffset50: ListAccountsRequest = { offset: 50 };

// Valid: offset omitted
const _listAccountsNoOffset: ListAccountsRequest = {};

// Invalid: offset must be number
// @ts-expect-error — `offset` must be number
const _listAccountsBadOffset: ListAccountsRequest = { offset: '50' };

// ---------------------------------------------------------------------------
// 10. CreateAdminUserRequest.actorType — UX-AD-011 optional, 'internal' | 'dealer'
// ---------------------------------------------------------------------------

// Valid: actorType omitted (defaults to internal per comment)
const _createAdminMinimal: CreateAdminUserRequest = {
  email: 'user@example.com',
  firstName: 'Ahmad',
  lastName: 'Hassan',
  role: 'SUPER_ADMIN',
};

// Valid: actorType = 'internal'
const _createAdminInternal: CreateAdminUserRequest = {
  email: 'user@example.com',
  firstName: 'Ahmad',
  lastName: 'Hassan',
  role: 'SUPER_ADMIN',
  actorType: 'internal',
};

// Valid: actorType = 'dealer'
const _createAdminDealer: CreateAdminUserRequest = {
  email: 'dealer@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  role: 'DEALER_PORTAL_USER',
  actorType: 'dealer',
};

// Invalid: 'service' is NOT in the CreateAdminUserRequest actorType union ('internal' | 'dealer' only)
// (Note: AdminUserSummary.actorType has 'service', but CreateAdminUserRequest only allows 'internal' | 'dealer')
const _createAdminService: CreateAdminUserRequest = {
  email: 'svc@example.com',
  firstName: 'Svc',
  lastName: 'Account',
  role: 'SUPER_ADMIN',
  // @ts-expect-error — 'service' is not assignable to 'internal' | 'dealer'
  actorType: 'service',
};

// Invalid: unknown actorType
const _createAdminBadActor: CreateAdminUserRequest = {
  email: 'x@example.com',
  firstName: 'X',
  lastName: 'Y',
  role: 'SUPER_ADMIN',
  // @ts-expect-error — 'superadmin' is not a valid actorType
  actorType: 'superadmin',
};

// ---------------------------------------------------------------------------
// Prevent unused-variable lint errors by exporting a namespace of all consts
// (tsc --noEmit only; these are never imported at runtime)
// ---------------------------------------------------------------------------
export type {
  LogLeadActivityNoteRequest,
  LogLeadActivityNoteResponse,
  ListLeadsRequest,
  TransitionLeadStageRequest,
  AccountLocationTypeKey,
  AccountLocationSummary,
  CreateAccountLocationRequest,
  UpdateAccountLocationRequest,
  ListAccountsRequest,
  CreateAdminUserRequest,
};
