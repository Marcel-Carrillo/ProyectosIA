import {
  ISupplierRepository,
  SupplierCreateData,
  SupplierUpdateData,
  SupplierListFilters,
  SupplierListResult,
} from '../../domain/repositories/supplierRepository';
import { Supplier } from '../../domain/models/supplier';
import { validateSupplierData } from '../validator';
import { SupplierNotFoundError } from '../../infrastructure/repositories/supplierRepository';

const MAX_PAGE_SIZE = 100;

export class SupplierService {
  constructor(private readonly repo: ISupplierRepository) {}

  async findAll(filters: SupplierListFilters = {}): Promise<SupplierListResult> {
    const pageSize =
      filters.pageSize !== undefined
        ? Math.min(Math.max(1, filters.pageSize), MAX_PAGE_SIZE)
        : 20;
    return this.repo.findAll({ ...filters, pageSize });
  }

  async findById(id: number): Promise<Supplier> {
    const supplier = await this.repo.findById(id);
    if (!supplier) throw new SupplierNotFoundError();
    return supplier;
  }

  async create(data: SupplierCreateData): Promise<Supplier> {
    validateSupplierData(data as unknown as Record<string, unknown>);
    return this.repo.create({ ...data, status: data.status ?? 'Active' });
  }

  async update(id: number, data: SupplierUpdateData): Promise<Supplier> {
    // Existence check first so a missing supplier returns 404 (not 400) before validation.
    const current = await this.repo.findById(id);
    if (!current) throw new SupplierNotFoundError();

    validateSupplierData(data as unknown as Record<string, unknown>, { requireName: false });
    return this.repo.update(id, data);
  }

  async softDelete(id: number): Promise<Supplier> {
    const current = await this.repo.findById(id);
    if (!current) throw new SupplierNotFoundError();
    return this.repo.softDelete(id);
  }
}
