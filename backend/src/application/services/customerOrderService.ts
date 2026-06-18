import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../infrastructure/prismaClient';
import {
  ICustomerOrderRepository,
  CustomerOrderCreateData,
  CustomerOrderListFilters,
  CustomerOrderListResult,
  CustomerOrderStatusUpdateData,
  ResolvedOrderLineItem,
} from '../../domain/repositories/customerOrderRepository';
import { CustomerOrder } from '../../domain/models/customerOrder';
import {
  validateCustomerOrderCreateData,
  validateCustomerOrderStatusUpdate,
  ValidationError,
} from '../validator';
import { CustomerNotFoundError } from '../../infrastructure/repositories/customerRepository';
import { VariantNotFoundError } from '../../infrastructure/repositories/productVariantRepository';
import { CustomerOrderNotFoundError } from '../../infrastructure/repositories/customerOrderRepository';

const MAX_PAGE_SIZE = 100;

const variantSelectForOrder = {
  id: true,
  sku: true,
  size: true,
  color: true,
  publicPrice: true,
  product: { select: { name: true } },
} as const;

export class CustomerOrderService {
  constructor(private readonly repo: ICustomerOrderRepository) {}

  async findAll(filters: CustomerOrderListFilters = {}): Promise<CustomerOrderListResult> {
    const pageSize =
      filters.pageSize !== undefined
        ? Math.min(Math.max(1, filters.pageSize), MAX_PAGE_SIZE)
        : 20;
    return this.repo.findAll({ ...filters, pageSize });
  }

  async findById(id: number): Promise<CustomerOrder> {
    const order = await this.repo.findById(id);
    if (!order) throw new CustomerOrderNotFoundError();
    return order;
  }

  async create(data: CustomerOrderCreateData): Promise<CustomerOrder> {
    validateCustomerOrderCreateData(data as unknown as Record<string, unknown>);

    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) throw new CustomerNotFoundError();

    const resolvedItems: ResolvedOrderLineItem[] = [];
    let subtotal = new Decimal(0);

    for (const item of data.items) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: item.productVariantId },
        select: variantSelectForOrder,
      });
      if (!variant) throw new VariantNotFoundError();

      const unitPrice = new Decimal(variant.publicPrice.toString());
      const lineTotal = unitPrice.mul(item.quantity);
      subtotal = subtotal.add(lineTotal);

      resolvedItems.push({
        productVariantId: variant.id,
        productNameSnapshot: variant.product.name,
        variantSnapshot: {
          size: variant.size,
          color: variant.color,
        },
        skuSnapshot: variant.sku,
        quantity: item.quantity,
        unitPrice: unitPrice.toFixed(2),
        totalPrice: lineTotal.toFixed(2),
      });
    }

    const shipping = new Decimal(String(data.shippingAmount ?? 0));
    const discount = new Decimal(String(data.discountAmount ?? 0));
    const total = subtotal.add(shipping).sub(discount);
    if (total.lessThan(0)) {
      throw new ValidationError('Total amount cannot be negative');
    }

    const orderNumber = await this.repo.generateNextOrderNumber();

    return this.repo.create(
      { ...data, orderNumber, currency: data.currency ?? 'EUR' },
      resolvedItems,
      {
        subtotal: subtotal.toFixed(2),
        shipping: shipping.toFixed(2),
        discount: discount.toFixed(2),
        total: total.toFixed(2),
      }
    );
  }

  async updateStatus(id: number, update: CustomerOrderStatusUpdateData): Promise<CustomerOrder> {
    const current = await this.repo.findById(id);
    if (!current) throw new CustomerOrderNotFoundError();

    validateCustomerOrderStatusUpdate(
      {
        status: current.status,
        paymentStatus: current.paymentStatus,
        fulfillmentStatus: current.fulfillmentStatus,
      },
      update as unknown as Record<string, unknown>
    );

    const statusUpdate: CustomerOrderStatusUpdateData = { ...update };

    if (update.paymentStatus === 'Paid' && !current.paidAt) {
      statusUpdate.paidAt = new Date();
    }
    if (update.status === 'Cancelled' && !current.cancelledAt) {
      statusUpdate.cancelledAt = new Date();
    }

    return this.repo.updateStatus(id, statusUpdate);
  }
}
