import { DataRecordEntityType, type DataSourceSystem, type SourceRecordSnapshot } from '@pulse/db';

type SnapshotInput = Pick<SourceRecordSnapshot, 'entityType' | 'externalId' | 'rawPayload' | 'sourceSystem'>;

type NormalizedPayload = {
  schemaVersion: number;
  targetEntityType: `${DataRecordEntityType}`;
  sourceSystem: `${DataSourceSystem}`;
  externalId: string;
  data: Record<string, unknown>;
  references?: Record<string, string>;
  sourceFields: Record<string, string>;
  validation: {
    missingRequiredFields: string[];
    notes: string[];
  };
};

export function normalizeSnapshot(snapshot: SnapshotInput) {
  switch (snapshot.entityType) {
    case DataRecordEntityType.ACCOUNT:
      return {
        targetEntityType: DataRecordEntityType.ACCOUNT,
        normalizedPayload: normalizeAccountSnapshot(snapshot),
      };
    case DataRecordEntityType.CONTACT:
      return {
        targetEntityType: DataRecordEntityType.CONTACT,
        normalizedPayload: normalizeContactSnapshot(snapshot),
      };
    case DataRecordEntityType.LOCATION:
      return {
        targetEntityType: DataRecordEntityType.LOCATION,
        normalizedPayload: normalizeLocationSnapshot(snapshot),
      };
    default:
      throw new Error(`Normalization is not implemented for entity type ${snapshot.entityType}`);
  }
}

function normalizeAccountSnapshot(snapshot: SnapshotInput): NormalizedPayload {
  const raw = asRecord(snapshot.rawPayload, 'ACCOUNT');
  const sourceFields: Record<string, string> = {};
  const validation = createValidationState();

  const displayName = pickString(raw, sourceFields, ['displayName', 'name', 'accountName', 'customerName', 'companyName', 'legalName']);
  const legalName = pickString(raw, sourceFields, ['legalName', 'companyName', 'customerName']);
  const accountNumber = pickString(raw, sourceFields, ['accountNumber', 'customerNumber', 'accountNo', 'customerNo', 'number', 'code']);
  const accountType = pickString(raw, sourceFields, ['accountType', 'type', 'customerType']);
  const isActive = pickBoolean(raw, sourceFields, ['isActive', 'active', 'enabled']) ?? true;

  if (!displayName) {
    validation.missingRequiredFields.push('displayName');
    validation.notes.push('No stable display name candidate was found in the source payload.');
  }

  return buildPayload(snapshot, {
    data: {
      ...(displayName ? { displayName } : {}),
      ...(legalName ? { legalName } : {}),
      ...(accountNumber ? { accountNumber } : {}),
      ...(accountType ? { accountType } : {}),
      isActive,
    },
    sourceFields,
    validation,
  });
}

function normalizeContactSnapshot(snapshot: SnapshotInput): NormalizedPayload {
  const raw = asRecord(snapshot.rawPayload, 'CONTACT');
  const sourceFields: Record<string, string> = {};
  const validation = createValidationState();

  const firstName = pickString(raw, sourceFields, ['firstName', 'givenName', 'contactFirstName']);
  const lastName = pickString(raw, sourceFields, ['lastName', 'surname', 'familyName', 'contactLastName']);
  const fullName = pickString(raw, sourceFields, ['fullName', 'name', 'contactName']);
  const splitName = splitFullName(fullName);
  const accountExternalId = pickString(raw, sourceFields, ['accountExternalId', 'accountId', 'customerId', 'parentAccountId', 'companyId']);
  const locationExternalId = pickString(raw, sourceFields, ['locationExternalId', 'locationId', 'siteId']);
  const title = pickString(raw, sourceFields, ['title', 'jobTitle']);
  const email = normalizeEmail(pickString(raw, sourceFields, ['email', 'emailAddress']));
  const phone = pickString(raw, sourceFields, ['phone', 'phoneNumber', 'telephone']);
  const mobilePhone = pickString(raw, sourceFields, ['mobilePhone', 'mobile', 'cellPhone']);
  const roleCode = pickString(raw, sourceFields, ['roleCode', 'role', 'contactRole']);
  const isPrimary = pickBoolean(raw, sourceFields, ['isPrimary', 'primaryContact']) ?? false;
  const isActive = pickBoolean(raw, sourceFields, ['isActive', 'active', 'enabled']) ?? true;

  const normalizedFirstName = firstName ?? splitName.firstName;
  const normalizedLastName = lastName ?? splitName.lastName;

  if (!accountExternalId) {
    validation.missingRequiredFields.push('accountExternalId');
    validation.notes.push('Contact import will need an account linkage before governed writes can occur.');
  }
  if (!normalizedFirstName) {
    validation.missingRequiredFields.push('firstName');
  }
  if (!normalizedLastName) {
    validation.missingRequiredFields.push('lastName');
  }

  return buildPayload(snapshot, {
    data: {
      ...(normalizedFirstName ? { firstName: normalizedFirstName } : {}),
      ...(normalizedLastName ? { lastName: normalizedLastName } : {}),
      ...(title ? { title } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(mobilePhone ? { mobilePhone } : {}),
      ...(roleCode ? { roleCode } : {}),
      isPrimary,
      isActive,
    },
    references: {
      ...(accountExternalId ? { accountExternalId } : {}),
      ...(locationExternalId ? { locationExternalId } : {}),
    },
    sourceFields,
    validation,
  });
}

function normalizeLocationSnapshot(snapshot: SnapshotInput): NormalizedPayload {
  const raw = asRecord(snapshot.rawPayload, 'LOCATION');
  const sourceFields: Record<string, string> = {};
  const validation = createValidationState();

  const accountExternalId = pickString(raw, sourceFields, ['accountExternalId', 'accountId', 'customerId', 'parentAccountId', 'companyId']);
  const locationCode = pickString(raw, sourceFields, ['locationCode', 'siteCode', 'branchCode', 'code']);
  const name = pickString(raw, sourceFields, ['name', 'locationName', 'siteName']);
  const line1 = pickString(raw, sourceFields, ['line1', 'address1', 'street1']);
  const line2 = pickString(raw, sourceFields, ['line2', 'address2', 'street2']);
  const city = pickString(raw, sourceFields, ['city', 'town']);
  const state = pickString(raw, sourceFields, ['state', 'province', 'region']);
  const postalCode = pickString(raw, sourceFields, ['postalCode', 'zip', 'zipCode']);
  const countryCode = normalizeCountryCode(pickString(raw, sourceFields, ['countryCode', 'country']));
  const isPrimary = pickBoolean(raw, sourceFields, ['isPrimary', 'primaryLocation']) ?? false;
  const isActive = pickBoolean(raw, sourceFields, ['isActive', 'active', 'enabled']) ?? true;

  if (!accountExternalId) {
    validation.missingRequiredFields.push('accountExternalId');
  }
  if (!(locationCode || name || line1)) {
    validation.missingRequiredFields.push('location identity');
    validation.notes.push('Location import expects at least one of locationCode, name, or line1.');
  }

  return buildPayload(snapshot, {
    data: {
      ...(locationCode ? { locationCode } : {}),
      ...(name ? { name } : {}),
      ...(line1 ? { line1 } : {}),
      ...(line2 ? { line2 } : {}),
      ...(city ? { city } : {}),
      ...(state ? { state } : {}),
      ...(postalCode ? { postalCode } : {}),
      ...(countryCode ? { countryCode } : {}),
      isPrimary,
      isActive,
    },
    references: {
      ...(accountExternalId ? { accountExternalId } : {}),
    },
    sourceFields,
    validation,
  });
}

function buildPayload(
  snapshot: SnapshotInput,
  input: {
    data: Record<string, unknown>;
    references?: Record<string, string> | undefined;
    sourceFields: Record<string, string>;
    validation: {
      missingRequiredFields: string[];
      notes: string[];
    };
  },
): NormalizedPayload {
  const payload: NormalizedPayload = {
    schemaVersion: 1,
    targetEntityType: snapshot.entityType,
    sourceSystem: snapshot.sourceSystem,
    externalId: snapshot.externalId,
    data: input.data,
    sourceFields: input.sourceFields,
    validation: input.validation,
  };

  if (input.references && Object.keys(input.references).length > 0) {
    payload.references = input.references;
  }

  return payload;
}

function createValidationState() {
  return {
    missingRequiredFields: [] as string[],
    notes: [] as string[],
  };
}

function asRecord(value: unknown, entityType: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${entityType} raw payload must be an object`);
  }

  return value as Record<string, unknown>;
}

function pickString(raw: Record<string, unknown>, sourceFields: Record<string, string>, candidates: string[]) {
  for (const candidate of candidates) {
    const value = raw[candidate];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        sourceFields[candidateAlias(candidate)] = candidate;
        return trimmed;
      }
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      sourceFields[candidateAlias(candidate)] = candidate;
      return String(value);
    }
  }

  return undefined;
}

function pickBoolean(raw: Record<string, unknown>, sourceFields: Record<string, string>, candidates: string[]) {
  for (const candidate of candidates) {
    const value = raw[candidate];
    if (typeof value === 'boolean') {
      sourceFields[candidateAlias(candidate)] = candidate;
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === 'yes' || normalized === '1' || normalized === 'active') {
        sourceFields[candidateAlias(candidate)] = candidate;
        return true;
      }
      if (normalized === 'false' || normalized === 'no' || normalized === '0' || normalized === 'inactive') {
        sourceFields[candidateAlias(candidate)] = candidate;
        return false;
      }
    }
    if (typeof value === 'number') {
      if (value === 1) {
        sourceFields[candidateAlias(candidate)] = candidate;
        return true;
      }
      if (value === 0) {
        sourceFields[candidateAlias(candidate)] = candidate;
        return false;
      }
    }
  }

  return undefined;
}

function splitFullName(fullName: string | undefined) {
  if (!fullName) {
    return {};
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return {};
  }
  if (parts.length === 1) {
    return {
      firstName: parts[0],
    };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1),
  };
}

function normalizeEmail(email: string | undefined) {
  return email?.trim().toLowerCase() || undefined;
}

function normalizeCountryCode(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.trim().toUpperCase();
}

function candidateAlias(candidate: string) {
  return candidate;
}
