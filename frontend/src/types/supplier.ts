export type SupplierStatus = 'Active' | 'Inactive' | 'Blocked';

export interface Supplier {
  id: number;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  notes: string | null; // internal-only field; never render in customer-facing views
  status: SupplierStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: SupplierStatus;
}

/** POST /api/admin/suppliers — name required; status defaults to Active server-side. */
export interface CreateSupplierInput {
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  notes?: string | null;
  status?: SupplierStatus;
}

/** PATCH /api/admin/suppliers/:id — all fields optional. */
export interface UpdateSupplierInput {
  name?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  notes?: string | null;
  status?: SupplierStatus;
}

export interface SupplierListResult {
  items: Supplier[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SupplierListResponse {
  success: boolean;
  data: SupplierListResult;
  message: string;
}

export interface SupplierResponse {
  success: boolean;
  data: Supplier;
  message: string;
}

export interface SupplierAdminApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
