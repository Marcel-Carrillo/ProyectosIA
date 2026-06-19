import { StripeWebhookEvent } from '../models/stripeWebhookEvent';

export interface StripeWebhookEventCreateData {
  stripeEventId: string;
  type: string;
  customerOrderId?: number | null;
}

export interface IStripeWebhookEventRepository {
  findByStripeEventId(stripeEventId: string): Promise<StripeWebhookEvent | null>;
  create(data: StripeWebhookEventCreateData): Promise<StripeWebhookEvent>;
}
