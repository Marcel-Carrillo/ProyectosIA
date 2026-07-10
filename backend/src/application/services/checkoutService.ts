import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../infrastructure/prismaClient';
import { CustomerOrderRepository } from '../../infrastructure/repositories/customerOrderRepository';
import { VariantNotFoundError } from '../../infrastructure/repositories/productVariantRepository';
import { couponService } from './wishlistCouponService';
import { ValidationError, validateCustomerOrderCreateData } from '../validator';
import { CustomerOrder } from '../../domain/models/customerOrder';
import { logger } from '../../infrastructure/logger';
import { paymentService } from './paymentService';

const variantSelectForOrder = {
  id: true,
  sku: true,
  size: true,
  color: true,
  publicPrice: true,
  status: true,
  product: { select: { name: true } },
} as const;

export interface CheckoutLineItem {
  productVariantId: number;
  quantity: number;
}

export interface CheckoutInput {
  customerId: number;
  items: CheckoutLineItem[];
  shippingAddressSnapshot: Record<string, unknown>;
  billingAddressSnapshot: Record<string, unknown>;
  couponCode?: string;
}

export interface GuestCheckoutInput extends CheckoutInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface CheckoutResult {
  order: {
    id?: number;
    orderNumber: string;
    customerId: number;
    status: string;
    paymentStatus: string;
    fulfillmentStatus: string;
    subtotalAmount: string;
    shippingAmount: string;
    discountAmount: string;
    totalAmount: string;
    currency: string;
    shippingAddressSnapshot: Record<string, unknown>;
    billingAddressSnapshot: Record<string, unknown>;
    createdAt?: Date;
    items: Array<{
      id?: number;
      productVariantId: number;
      productNameSnapshot: string;
      variantSnapshot: Record<string, unknown>;
      skuSnapshot: string;
      quantity: number;
      unitPrice: string;
      totalPrice: string;
    }>;
  };
  clientSecret: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class GuestEmailHasAccountError extends Error {
  readonly code = 'EMAIL_HAS_ACCOUNT' as const;
  readonly status = 409;

  constructor() {
    super('This email belongs to a registered account. Please log in to place your order.');
    this.name = 'GuestEmailHasAccountError';
    Object.setPrototypeOf(this, GuestEmailHasAccountError.prototype);
  }
}

export class CheckoutService {
  private readonly orderRepo = new CustomerOrderRepository();

  async createOrder(input: CheckoutInput): Promise<CheckoutResult> {
    // Same server-side validation as the admin order-creation path: integer
    // quantities >= 1 and well-formed address snapshots. Prices and shipping
    // are always resolved server-side — nothing monetary is trusted from the
    // request body.
    validateCustomerOrderCreateData({
      customerId: input.customerId,
      items: input.items,
      shippingAddressSnapshot: input.shippingAddressSnapshot,
      billingAddressSnapshot: input.billingAddressSnapshot,
    });

    const resolvedItems: Array<{
      productVariantId: number;
      productNameSnapshot: string;
      variantSnapshot: { size: string | null; color: string | null };
      skuSnapshot: string;
      quantity: number;
      unitPrice: string;
      totalPrice: string;
    }> = [];

    let subtotal = new Decimal(0);

    for (const item of input.items) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: item.productVariantId },
        select: variantSelectForOrder,
      });
      if (!variant || variant.status !== 'Active') throw new VariantNotFoundError();

      const unitPrice = new Decimal(variant.publicPrice.toString());
      const lineTotal = unitPrice.mul(item.quantity);
      subtotal = subtotal.add(lineTotal);

      resolvedItems.push({
        productVariantId: variant.id,
        productNameSnapshot: variant.product.name,
        variantSnapshot: { size: variant.size, color: variant.color },
        skuSnapshot: variant.sku,
        quantity: item.quantity,
        unitPrice: unitPrice.toFixed(2),
        totalPrice: lineTotal.toFixed(2),
      });
    }

    // Flat-rate shipping is currently free; when real shipping pricing lands it
    // must be computed here, never taken from the request.
    const shipping = new Decimal(0);
    let discount = new Decimal(0);

    if (input.couponCode) {
      const validation = await couponService.validate(input.couponCode, subtotal.toFixed(2), input.customerId);
      if (!validation.valid) {
        if (validation.reason === 'exhausted') {
          const { CouponExhaustedError } = await import('./wishlistCouponService');
          throw new CouponExhaustedError();
        }
        const { CouponNotFoundError } = await import('./wishlistCouponService');
        throw new CouponNotFoundError();
      }
      discount = new Decimal(validation.discountAmount);
    }

    const orderNumber = await this.orderRepo.generateNextOrderNumber();
    const total = subtotal.add(shipping).sub(discount);
    if (total.lessThan(0)) {
      throw new ValidationError('Total amount cannot be negative');
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.customerOrder.create({
        data: {
          orderNumber,
          customerId: input.customerId,
          status: 'PendingPayment',
          paymentStatus: 'Pending',
          fulfillmentStatus: 'NotStarted',
          subtotalAmount: subtotal,
          shippingAmount: shipping,
          discountAmount: discount,
          totalAmount: total,
          currency: 'EUR',
          shippingAddressSnapshot: input.shippingAddressSnapshot as object,
          billingAddressSnapshot: input.billingAddressSnapshot as object,
          items: {
            create: resolvedItems.map((line) => ({
              productVariantId: line.productVariantId,
              productNameSnapshot: line.productNameSnapshot,
              variantSnapshot: line.variantSnapshot,
              skuSnapshot: line.skuSnapshot,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              totalPrice: line.totalPrice,
            })),
          },
        },
        include: { items: true },
      });

      if (input.couponCode) {
        await couponService.applyInTransaction(tx, input.couponCode, subtotal, created.id);
      }

      return created;
    });

    // Call Stripe to create PaymentIntent — rollback order on failure
    let clientSecret: string;
    let stripePaymentIntentId: string;
    try {
      const piResult = await paymentService.createPaymentIntent({
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount.toString(),
        currency: 'EUR',
      } as CustomerOrder);
      clientSecret = piResult.clientSecret;
      stripePaymentIntentId = piResult.stripePaymentIntentId;
    } catch (err) {
      // Release the coupon use first (decrements usedCount and removes the
      // redemption), then delete the order. The redemption FK also cascades on
      // order delete, but the cascade alone would leave usedCount consumed.
      try {
        if (input.couponCode) {
          await couponService.releaseForOrder(order.id);
        }
        await prisma.customerOrder.delete({ where: { id: order.id } });
      } catch {
        logger.error('Failed to rollback order after Stripe error', { orderId: order.id });
      }
      throw err;
    }

    await prisma.customerOrder.update({
      where: { id: order.id },
      data: { stripePaymentIntentId },
    });

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        subtotalAmount: order.subtotalAmount.toString(),
        shippingAmount: order.shippingAmount.toString(),
        discountAmount: order.discountAmount.toString(),
        totalAmount: order.totalAmount.toString(),
        currency: order.currency,
        shippingAddressSnapshot: order.shippingAddressSnapshot as Record<string, unknown>,
        billingAddressSnapshot: order.billingAddressSnapshot as Record<string, unknown>,
        createdAt: order.createdAt,
        items: (order.items ?? []).map((item) => ({
          id: item.id,
          productVariantId: item.productVariantId,
          productNameSnapshot: item.productNameSnapshot,
          variantSnapshot: item.variantSnapshot as Record<string, unknown>,
          skuSnapshot: item.skuSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          totalPrice: item.totalPrice.toString(),
        })),
      },
      clientSecret,
    };
  }

  async guestCheckout(input: GuestCheckoutInput): Promise<CheckoutResult> {
    const email = normalizeEmail(input.email);
    const existing = await prisma.customer.findUnique({
      where: { email },
      select: { id: true, account: { select: { id: true } } },
    });
    // Anyone can type any email into the guest form. If that email belongs to
    // a registered account, refuse: otherwise a stranger could inject orders
    // into another customer's order history.
    if (existing?.account) {
      throw new GuestEmailHasAccountError();
    }

    let customerId = existing?.id;
    if (customerId === undefined) {
      const customer = await prisma.customer.create({
        data: {
          email,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          phone: input.phone?.trim() || null,
        },
      });
      customerId = customer.id;
    }

    return this.createOrder({ ...input, customerId });
  }
}

export const checkoutService = new CheckoutService();
