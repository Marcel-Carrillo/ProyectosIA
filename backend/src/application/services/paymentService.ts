import Stripe from 'stripe';
import { Decimal } from '@prisma/client/runtime/library';
import { stripe } from '../../infrastructure/stripe/stripeClient';
import { toStripeAmount } from '../../infrastructure/stripe/toStripeAmount';
import { CustomerOrder } from '../../domain/models/customerOrder';
import { ICustomerOrderRepository } from '../../domain/repositories/customerOrderRepository';
import { IStripeWebhookEventRepository } from '../../domain/repositories/stripeWebhookEventRepository';
import { CustomerOrderRepository } from '../../infrastructure/repositories/customerOrderRepository';
import { StripeWebhookEventRepository } from '../../infrastructure/repositories/stripeWebhookEventRepository';
import {
  PaymentGatewayUnavailableError,
  PaymentWebhookSignatureInvalidError,
} from '../validator';
import { prisma } from '../../infrastructure/prismaClient';
import { logger } from '../../infrastructure/logger';

export class PaymentService {
  constructor(
    private readonly orderRepo: ICustomerOrderRepository,
    private readonly webhookEventRepo: IStripeWebhookEventRepository
  ) {}

  getConfig(): { publishableKey: string; mode: string } {
    return {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
      mode: process.env.STRIPE_MODE ?? 'test',
    };
  }

  async createPaymentIntent(
    order: CustomerOrder
  ): Promise<{ clientSecret: string; stripePaymentIntentId: string }> {
    const amountDecimal = new Decimal(order.totalAmount);
    const amount = toStripeAmount(amountDecimal, order.currency);

    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.create(
        {
          amount,
          currency: order.currency.toLowerCase(),
          metadata: {
            customerOrderId: String(order.id),
            orderNumber: order.orderNumber,
          },
          automatic_payment_methods: { enabled: true },
        },
        { idempotencyKey: `order:${order.orderNumber}:pi` }
      );
    } catch (err) {
      logger.error('Stripe PaymentIntent creation failed', {
        orderNumber: order.orderNumber,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new PaymentGatewayUnavailableError();
    }

    if (!intent.client_secret) {
      throw new PaymentGatewayUnavailableError('PaymentIntent missing client_secret');
    }

    return {
      clientSecret: intent.client_secret,
      stripePaymentIntentId: intent.id,
    };
  }

  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (_err) {
      throw new PaymentWebhookSignatureInvalidError();
    }

    const existing = await this.webhookEventRepo.findByStripeEventId(event.id);
    if (existing) {
      logger.info('Stripe webhook event already processed — skipping', { eventId: event.id });
      return;
    }

    try {
      if (event.type === 'payment_intent.succeeded') {
        await this.handlePaymentIntentSucceeded(event);
      } else if (event.type === 'payment_intent.payment_failed') {
        await this.handlePaymentIntentFailed(event);
      } else if (event.type === 'charge.refunded') {
        await this.handleChargeRefunded(event);
      } else {
        logger.info('Stripe webhook event type not handled', { type: event.type });
      }
    } catch (err) {
      logger.error('Stripe webhook event handler error', {
        eventId: event.id,
        type: event.type,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await this.webhookEventRepo.create({
      stripeEventId: event.id,
      type: event.type,
    });
  }

  private async handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void> {
    const intent = event.data.object as Stripe.PaymentIntent;
    const order = await this.orderRepo.findByStripePaymentIntentId(intent.id);

    if (!order) {
      logger.warn('payment_intent.succeeded: order not found for PaymentIntent', {
        stripePaymentIntentId: intent.id,
      });
      return;
    }

    if (order.paymentStatus === 'Paid') {
      logger.info('payment_intent.succeeded: order already Paid — skipping', {
        orderId: order.id,
      });
      return;
    }

    const chargeId =
      typeof intent.latest_charge === 'string'
        ? intent.latest_charge
        : (intent.latest_charge as Stripe.Charge | null)?.id ?? null;

    await prisma.customerOrder.update({
      where: { id: order.id },
      data: {
        status: 'Paid',
        paymentStatus: 'Paid',
        paidAt: new Date(),
        ...(chargeId !== null && { stripeChargeId: chargeId }),
      },
    });

    logger.info('payment_intent.succeeded: order marked Paid', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      chargeId: chargeId ?? undefined,
    });
  }

  private async handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
    const intent = event.data.object as Stripe.PaymentIntent;
    const order = await this.orderRepo.findByStripePaymentIntentId(intent.id);

    if (!order) {
      logger.warn('payment_intent.payment_failed: order not found for PaymentIntent', {
        stripePaymentIntentId: intent.id,
      });
      return;
    }

    await prisma.customerOrder.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'Failed',
      },
    });

    logger.info('payment_intent.payment_failed: order paymentStatus set to Failed', {
      orderId: order.id,
    });
  }

  private async handleChargeRefunded(event: Stripe.Event): Promise<void> {
    const charge = event.data.object as Stripe.Charge;
    const stripeRefunds = charge.refunds?.data ?? [];

    for (const stripeRefund of stripeRefunds) {
      const refundRecord = await prisma.refund.findFirst({
        where: { paymentProviderReference: stripeRefund.id },
        select: { id: true, status: true, customerOrderId: true },
      });

      if (!refundRecord) {
        logger.warn('charge.refunded: no local Refund found for Stripe refund id', {
          stripeRefundId: stripeRefund.id,
        });
        continue;
      }

      if (refundRecord.status === 'Completed') {
        logger.info('charge.refunded: refund already Completed — skipping', {
          refundId: refundRecord.id,
        });
        continue;
      }

      if (refundRecord.status !== 'Processing') {
        logger.warn('charge.refunded: refund not in Processing state — skipping', {
          refundId: refundRecord.id,
          status: refundRecord.status,
        });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const processedAt = new Date();

        await tx.refund.update({
          where: { id: refundRecord.id },
          data: { status: 'Completed', processedAt },
        });

        const completedRefunds = await tx.refund.findMany({
          where: {
            customerOrderId: refundRecord.customerOrderId,
            status: 'Completed',
          },
          select: { amount: true },
        });

        const completedSum = completedRefunds.reduce(
          (acc: Decimal, r: { amount: { toString(): string } }) =>
            acc.plus(r.amount.toString()),
          new Decimal(0)
        );

        const orderRow = await tx.customerOrder.findUnique({
          where: { id: refundRecord.customerOrderId },
          select: { totalAmount: true },
        });

        if (orderRow) {
          const totalAmount = new Decimal(orderRow.totalAmount.toString());
          const newPaymentStatus = completedSum.isZero()
            ? 'Paid'
            : completedSum.gte(totalAmount)
              ? 'Refunded'
              : 'PartiallyRefunded';

          await tx.customerOrder.update({
            where: { id: refundRecord.customerOrderId },
            data: { paymentStatus: newPaymentStatus },
          });
        }
      });

      logger.info('charge.refunded: refund transitioned to Completed', {
        refundId: refundRecord.id,
      });
    }
  }
}

export const paymentService = new PaymentService(
  new CustomerOrderRepository(),
  new StripeWebhookEventRepository()
);
