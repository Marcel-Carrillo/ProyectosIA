import { prisma } from '../prismaClient';
import { Supplier } from '../../domain/models/supplier';
import {
  ISupplierRepository,
  SupplierCreateData,
  SupplierUpdateData,
  SupplierListFilters,
  SupplierListResult,
} from '../../domain/repositories/supplierRepository';

export class SupplierNotFoundError extends Error {
  readonly code = 'SUPPLIER_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Supplier not found');
    this.name = 'SupplierNotFoundError';
    Object.setPrototypeOf(this, SupplierNotFoundError.prototype);
  }
}

export class SupplierRepository implements ISupplierRepository {
  async findAll(filters: SupplierListFilters = {}): Promise<SupplierListResult> {
    const page =
      filters.page != null && Number.isFinite(filters.page) && filters.page >= 1
        ? filters.page
        : 1;
    const pageSize =
      filters.pageSize != null && Number.isFinite(filters.pageSize) && filters.pageSize >= 1
        ? filters.pageSize
        : 20;
    const skip = (page - 1) * pageSize;

    // Supplier has no deletedAt column: all rows are returned unless an explicit
    // status filter is supplied. The status filter is an opt-in query param.
    const where: Record<string, unknown> = {};
    if (filters.status) where['status'] = filters.status;
    if (filters.search) {
      where['name'] = { contains: filters.search, mode: 'insensitive' };
    }

    const [rows, total] = await prisma.$transaction([
      prisma.supplier.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.supplier.count({ where }),
    ]);

    return {
      items: rows.map((r) => new Supplier(r)),
      total,
      page,
      pageSize,
    };
  }

  async findById(id: number): Promise<Supplier | null> {
    const row = await prisma.supplier.findUnique({ where: { id } });
    return row ? new Supplier(row) : null;
  }

  async create(data: SupplierCreateData): Promise<Supplier> {
    const row = await prisma.supplier.create({
      data: {
        name: data.name,
        contactName: data.contactName ?? null,
        contactEmail: data.contactEmail ?? null,
        contactPhone: data.contactPhone ?? null,
        website: data.website ?? null,
        notes: data.notes ?? null,
        status: data.status ?? 'Active',
      },
    });
    return new Supplier(row);
  }

  async update(id: number, data: SupplierUpdateData): Promise<Supplier> {
    const current = await this.findById(id);
    if (!current) throw new SupplierNotFoundError();

    const row = await prisma.supplier.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.contactName !== undefined && { contactName: data.contactName }),
        ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail }),
        ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
    return new Supplier(row);
  }

  async softDelete(id: number): Promise<Supplier> {
    // Soft-delete = set status to 'Inactive'. The row is never physically removed,
    // preserving referential integrity with ProductVariant (and future SupplierOrder).
    const current = await this.findById(id);
    if (!current) throw new SupplierNotFoundError();

    const row = await prisma.supplier.update({
      where: { id },
      data: { status: 'Inactive' },
    });
    return new Supplier(row);
  }
}
