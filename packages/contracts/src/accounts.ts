export interface AccountSummary {
  id: string;
  accountNumber?: string;
  displayName: string;
  legalName?: string;
  accountType?: string;
  isActive: boolean;
  contactCount: number;
  locationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AccountLocationSummary {
  id: string;
  locationCode?: string;
  name?: string;
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  isPrimary: boolean;
  isActive: boolean;
}

export interface ContactSummary {
  id: string;
  accountId: string;
  locationId?: string;
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  roleCode?: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDetail extends AccountSummary {
  locations: AccountLocationSummary[];
  contacts: ContactSummary[];
}

export interface ListAccountsRequest {
  search?: string;
  limit?: number;
  includeInactive?: boolean;
}

export interface ListAccountsResponse {
  items: AccountSummary[];
  total: number;
}

export interface CreateAccountRequest {
  displayName: string;
  legalName?: string;
  accountType?: string;
  isActive?: boolean;
}

export interface CreateContactRequest {
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  roleCode?: string;
  locationId?: string;
  isPrimary?: boolean;
  isActive?: boolean;
}
