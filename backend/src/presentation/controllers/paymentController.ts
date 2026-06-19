import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../../application/services/paymentService';
import { PaymentWebhookSignatureInvalidError } from '../../application/validator';

export async function getConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const config = paymentService.getConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
}

export async function handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          message: 'Missing Stripe-Signature header',
          code: 'PAYMENT_WEBHOOK_SIGNATURE_INVALID',
        },
      });
      return;
    }

    const rawBody = req.body as Buffer;
    await paymentService.handleWebhookEvent(rawBody, signature);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof PaymentWebhookSignatureInvalidError) {
      res.status(400).json({
        success: false,
        error: { message: err.message, code: err.code },
      });
      return;
    }
    next(err);
  }
}
