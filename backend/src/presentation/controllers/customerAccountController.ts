import { Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/prismaClient';
import { CustomerAuthRequest } from '../../middleware/requireCustomerAuth';
import { toCustomerPublic } from '../../domain/models/customerAccount';
import { CustomerOrderNotFoundError } from '../../infrastructure/repositories/customerOrderRepository';
import { customerAuthService } from '../../application/services/customerAuthService';

function toPublicOrder(order: {
  id: number;
  orderNumber: string;
  customerId: number;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  subtotalAmount: { toString(): string };
  shippingAmount: { toString(): string };
  discountAmount: { toString(): string };
  totalAmount: { toString(): string };
  currency: string;
  shippingAddressSnapshot: unknown;
  billingAddressSnapshot: unknown;
  createdAt: Date;
  items?: Array<{
    id: number;
    productVariantId: number;
    productNameSnapshot: string;
    variantSnapshot: unknown;
    skuSnapshot: string;
    quantity: number;
    unitPrice: { toString(): string };
    totalPrice: { toString(): string };
    fulfillmentStatus: string;
  }>;
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    subtotalAmount: order.subtotalAmount.toString(),
    shippingAmount: order.shippingAmount.toString(),
    discountAmount: order.discountAmount.toString(),
    totalAmount: order.totalAmount.toString(),
    currency: order.currency,
    shippingAddressSnapshot: order.shippingAddressSnapshot,
    billingAddressSnapshot: order.billingAddressSnapshot,
    createdAt: order.createdAt,
    items: order.items?.map((item) => ({
      id: item.id,
      productVariantId: item.productVariantId,
      productNameSnapshot: item.productNameSnapshot,
      variantSnapshot: item.variantSnapshot,
      skuSnapshot: item.skuSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      totalPrice: item.totalPrice.toString(),
      fulfillmentStatus: item.fulfillmentStatus,
    })),
  };
}

export async function getProfile(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.customer!.customerId } });
    if (!customer) {
      res.status(404).json({ success: false, error: { message: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' } });
      return;
    }
    res.json({ success: true, data: { customer: toCustomerPublic(customer) }, message: 'Profile retrieved' });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const { firstName, lastName, phone } = req.body as {
      firstName?: string;
      lastName?: string;
      phone?: string;
    };
    const customer = await prisma.customer.update({
      where: { id: req.customer!.customerId },
      data: {
        ...(firstName !== undefined && { firstName: firstName.trim() }),
        ...(lastName !== undefined && { lastName: lastName.trim() }),
        ...(phone !== undefined && { phone: phone.trim() || null }),
      },
    });
    res.json({ success: true, data: { customer: toCustomerPublic(customer) }, message: 'Profile updated' });
  } catch (err) {
    next(err);
  }
}

export async function listOrders(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const page = parseInt(String(req.query.page ?? '1'), 10);
    const pageSize = Math.min(parseInt(String(req.query.pageSize ?? '20'), 10), 100);
    const [items, total] = await Promise.all([
      prisma.customerOrder.findMany({
        where: { customerId: req.customer!.customerId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { items: true },
      }),
      prisma.customerOrder.count({ where: { customerId: req.customer!.customerId } }),
    ]);
    res.json({
      success: true,
      data: { items: items.map(toPublicOrder), total, page, pageSize },
      message: 'Orders retrieved',
    });
  } catch (err) {
    next(err);
  }
}

export async function getOrderById(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id as string, 10);
    const order = await prisma.customerOrder.findFirst({
      where: { id, customerId: req.customer!.customerId },
      include: { items: true },
    });
    if (!order) throw new CustomerOrderNotFoundError();
    res.json({ success: true, data: toPublicOrder(order), message: 'Order retrieved' });
  } catch (err) {
    next(err);
  }
}

export async function setup2fa(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await customerAuthService.setup2fa(req.customer!.accountId);
    res.json({ success: true, data, message: '2FA setup initiated' });
  } catch (err) {
    next(err);
  }
}

export async function confirm2fa(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const { code } = req.body as { code?: string };
    if (!code) {
      res.status(400).json({ success: false, error: { message: 'Code required', code: 'VALIDATION_ERROR' } });
      return;
    }
    await customerAuthService.confirm2fa(req.customer!.accountId, code);
    res.json({ success: true, data: null, message: '2FA enabled' });
  } catch (err) {
    next(err);
  }
}

export async function disable2fa(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const { password } = req.body as { password?: string };
    if (!password) {
      res.status(400).json({ success: false, error: { message: 'Password required', code: 'VALIDATION_ERROR' } });
      return;
    }
    await customerAuthService.disable2fa(req.customer!.accountId, password);
    res.json({ success: true, data: null, message: '2FA disabled' });
  } catch (err) {
    next(err);
  }
}
