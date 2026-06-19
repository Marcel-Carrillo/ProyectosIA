import { prisma } from '../prismaClient';
import { StripeWebhookEvent } from '../../domain/models/stripeWebhookEvent';
import {
  IStripeWebhookEventRepository,
  StripeWebhookEventCreateData,
} from '../../domain/repositories/stripeWebhookEventRepository';

const webhookEventSelect = {
  id: true,
  stripeEventId: true,
  type: true,
  customerOrderId: true,
  createdAt: true,
} as const;

export class StripeWebhookEventRepository implements IStripeWebhookEventRepository {
  async findByStripeEventId(stripeEventId: string): Promise<StripeWebhookEvent | null> {
    const row = await prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId },
      select: webhookEventSelect,
    });
    return row ? new StripeWebhookEvent(row) : null;
  }

  async create(data: StripeWebhookEventCreateData): Promise<StripeWebhookEvent> {
    const row = await prisma.stripeWebhookEvent.create({
      data: {
        stripeEventId: data.stripeEventId,
        type: data.type,
        customerOrderId: data.customerOrderId ?? null,
      },
      select: webhookEventSelect,
    });
    return new StripeWebhookEvent(row);
  }
}
