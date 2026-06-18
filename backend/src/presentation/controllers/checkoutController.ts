import { Response, NextFunction } from 'express';
import { checkoutService } from '../../application/services/checkoutService';
import { CustomerAuthRequest } from '../../middleware/requireCustomerAuth';

function toPublicOrder(order: NonNullable<Awaited<ReturnType<typeof checkoutService.createOrder>>>) {
  return {
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
    shippingAddressSnapshot: order.shippingAddressSnapshot,
    billingAddressSnapshot: order.billingAddressSnapshot,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      productVariantId: item.productVariantId,
      productNameSnapshot: item.productNameSnapshot,
      variantSnapshot: item.variantSnapshot,
      skuSnapshot: item.skuSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      totalPrice: item.totalPrice.toString(),
    })),
  };
}

export async function guestCheckout(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      items?: Array<{ productVariantId: number; quantity: number }>;
      shippingAddressSnapshot?: Record<string, unknown>;
      billingAddressSnapshot?: Record<string, unknown>;
      shippingAmount?: string;
      couponCode?: string;
    };
    if (!body.email || !body.firstName || !body.lastName || !body.items?.length || !body.shippingAddressSnapshot || !body.billingAddressSnapshot) {
      res.status(400).json({ success: false, error: { message: 'Invalid checkout payload', code: 'VALIDATION_ERROR' } });
      return;
    }
    const order = await checkoutService.guestCheckout({
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      customerId: 0,
      items: body.items,
      shippingAddressSnapshot: body.shippingAddressSnapshot,
      billingAddressSnapshot: body.billingAddressSnapshot,
      shippingAmount: body.shippingAmount,
      couponCode: body.couponCode,
    });
    res.status(201).json({ success: true, data: toPublicOrder(order), message: 'Order created' });
  } catch (err) {
    next(err);
  }
}

export async function authenticatedCheckout(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      items?: Array<{ productVariantId: number; quantity: number }>;
      shippingAddressSnapshot?: Record<string, unknown>;
      billingAddressSnapshot?: Record<string, unknown>;
      shippingAmount?: string;
      couponCode?: string;
    };
    if (!body.items?.length || !body.shippingAddressSnapshot || !body.billingAddressSnapshot) {
      res.status(400).json({ success: false, error: { message: 'Invalid checkout payload', code: 'VALIDATION_ERROR' } });
      return;
    }
    const order = await checkoutService.createOrder({
      customerId: req.customer!.customerId,
      items: body.items,
      shippingAddressSnapshot: body.shippingAddressSnapshot,
      billingAddressSnapshot: body.billingAddressSnapshot,
      shippingAmount: body.shippingAmount,
      couponCode: body.couponCode,
    });
    res.status(201).json({ success: true, data: toPublicOrder(order), message: 'Order created' });
  } catch (err) {
    next(err);
  }
}
