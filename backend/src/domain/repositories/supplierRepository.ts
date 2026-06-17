import { Supplier } from '../models/supplier';

export interface SupplierCreateData {
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  notes?: string | null;
  status?: string;
}

export interface SupplierUpdateData {
  name?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  notes?: string | null;
  status?: string;
}

export interface SupplierListFilters {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface SupplierListResult {
  items: Supplier[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ISupplierRepository {
  findAll(filters?: SupplierListFilters): Promise<SupplierListResult>;
  findById(id: number): Promise<Supplier | null>;
  create(data: SupplierCreateData): Promise<Supplier>;
  update(id: number, data: SupplierUpdateData): Promise<Supplier>;
  softDelete(id: number): Promise<Supplier>;
}
