import { Request, Response, NextFunction } from 'express';
import { couponService } from '../../application/services/wishlistCouponService';

export async function validateCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, subtotalAmount } = req.body as { code?: string; subtotalAmount?: string };
    if (!code || subtotalAmount === undefined) {
      res.status(400).json({
        success: false,
        error: { message: 'code and subtotalAmount required', code: 'VALIDATION_ERROR' },
      });
      return;
    }
    try {
      const result = await couponService.validate(code, String(subtotalAmount));
      if (!result.valid) {
        res.json({ success: true, data: result, message: 'Coupon invalid' });
        return;
      }
      res.json({ success: true, data: result, message: 'Coupon valid' });
    } catch (err) {
      if ((err as { code?: string }).code === 'COUPON_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { message: 'Coupon not found', code: 'COUPON_NOT_FOUND' },
        });
        return;
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}
