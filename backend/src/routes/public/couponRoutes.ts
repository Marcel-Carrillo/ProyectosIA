import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validateCoupon } from '../../presentation/controllers/couponController';

const router = Router();

const couponLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/validate', couponLimiter, validateCoupon);

export default router;
