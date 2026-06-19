export class StripeWebhookEvent {
  id?: number;
  stripeEventId: string;
  type: string;
  customerOrderId: number | null;
  createdAt?: Date;

  constructor(data: {
    id?: number;
    stripeEventId: string;
    type: string;
    customerOrderId?: number | null;
    createdAt?: Date;
  }) {
    this.id = data.id;
    this.stripeEventId = data.stripeEventId;
    this.type = data.type;
    this.customerOrderId = data.customerOrderId ?? null;
    this.createdAt = data.createdAt;
  }
}
