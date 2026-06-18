import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../infrastructure/prismaClient';
import {
  ISupplierOrderRepository,
  SupplierOrderCreateData,
  SupplierOrderListFilters,
  SupplierOrderListResult,
  SupplierOrderStatusUpdateData,
  GenerateSupplierOrdersResult,
} from '../../domain/repositories/supplierOrderRepository';
import { SupplierOrder } from '../../domain/models/supplierOrder';
import {
  validateSupplierOrderCreateData,
  validateSupplierOrderStatusUpdate,
  validateCustomerOrderEligibleForSupplierOrder,
  ValidationError,
} from '../validator';
import { CustomerOrderNotFoundError } from '../../infrastructure/repositories/customerOrderRepository';
import {
  SupplierOrderNotFoundError,
  SupplierBlockedError,
  VariantSupplierMissingError,
} from '../../infrastructure/repositories/supplierOrderRepository';
import { SupplierNotFoundError } from '../../infrastructure/repositories/supplierRepository';

const MAX_PAGE_SIZE = 100;

export class SupplierOrderService {
  constructor(private readonly repo: ISupplierOrderRepository) {}

  async findAll(filters: SupplierOrderListFilters = {}): Promise<SupplierOrderListResult> {
    const pageSize =
      filters.pageSize !== undefined
        ? Math.min(Math.max(1, filters.pageSize), MAX_PAGE_SIZE)
        : 20;
    return this.repo.findAll({ ...filters, pageSize });
  }

  async findById(id: number): Promise<SupplierOrder> {
    const order = await this.repo.findById(id);
    if (!order) throw new SupplierOrderNotFoundError();
    return order;
  }

  async findByCustomerOrderId(customerOrderId: number): Promise<SupplierOrder[]> {
    return this.repo.findByCustomerOrderId(customerOrderId);
  }

  async create(data: SupplierOrderCreateData): Promise<SupplierOrder> {
    validateSupplierOrderCreateData(data as unknown as Record<string, unknown>);

    const customerOrder = await prisma.customerOrder.findUnique({
      where: { id: data.customerOrderId },
      include: { items: true },
    });
    if (!customerOrder) throw new CustomerOrderNotFoundError();
    validateCustomerOrderEligibleForSupplierOrder(customerOrder.status);

    const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
    if (!supplier) throw new SupplierNotFoundError();
    if (supplier.status === 'Blocked') throw new SupplierBlockedError();

    const itemIds = new Set(customerOrder.items.map((i) => i.id));
    const resolvedItems = [];

    for (const item of data.items) {
      if (!itemIds.has(item.customerOrderItemId)) {
        throw new ValidationError('Each item must belong to the given customer order');
      }

      const variant = await prisma.productVariant.findUnique({
        where: { id: item.productVariantId },
        select: {
          id: true,
          supplierId: true,
          supplierReference: true,
          supplierCost: true,
        },
      });
      if (!variant) throw new ValidationError('Product variant not found');
      if (variant.supplierId !== data.supplierId) {
        throw new ValidationError('Product variant supplier does not match order supplier');
      }

      resolvedItems.push({
        ...item,
        supplierReferenceSnapshot: variant.supplierReference,
        supplierCost: item.supplierCost ?? new Decimal(variant.supplierCost?.toString() ?? '0').toFixed(2),
      });
    }

    const supplierOrderNumber = await this.repo.generateNextSupplierOrderNumber();

    return this.repo.create({
      ...data,
      supplierOrderNumber,
      items: resolvedItems,
    });
  }

  async generateFromCustomerOrder(customerOrderId: number): Promise<GenerateSupplierOrdersResult> {
    return this.repo.generateFromCustomerOrder(customerOrderId);
  }

  async updateStatus(
    id: number,
    update: SupplierOrderStatusUpdateData
  ): Promise<SupplierOrder> {
    const current = await this.repo.findById(id);
    if (!current) throw new SupplierOrderNotFoundError();

    validateSupplierOrderStatusUpdate(current.status, update as unknown as Record<string, unknown>);

    const statusUpdate: SupplierOrderStatusUpdateData = { ...update };
    const now = new Date();

    if (update.status === 'Requested' && !current.requestedAt) {
      statusUpdate.requestedAt = now;
    }
    if (update.status === 'Confirmed' && !current.confirmedAt) {
      statusUpdate.confirmedAt = now;
    }
    if (update.status === 'Shipped' && !current.shippedAt) {
      statusUpdate.shippedAt = now;
    }
    if (update.status === 'Delivered' && !current.deliveredAt) {
      statusUpdate.deliveredAt = now;
    }

    return this.repo.updateStatus(id, statusUpdate);
  }
}
