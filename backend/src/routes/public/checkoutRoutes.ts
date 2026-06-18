import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { guestCheckout, authenticatedCheckout } from '../../presentation/controllers/checkoutController';
import { requireCustomerAuth } from '../../middleware/requireCustomerAuth';

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.use(checkoutLimiter);
router.post('/guest', guestCheckout);
router.post('/', requireCustomerAuth, authenticatedCheckout);

export default router;
