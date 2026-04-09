export interface ReferenceValueSummary {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceListResponse<TItem> {
  items: TItem[];
}

export interface UpdateReferenceValueRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CreateLeadSourceRequest {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}
