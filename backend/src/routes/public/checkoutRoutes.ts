import { Router } from 'express';
import { guestCheckout, authenticatedCheckout } from '../../presentation/controllers/checkoutController';
import { requireCustomerAuth } from '../../middleware/requireCustomerAuth';

const router = Router();

router.post('/guest', guestCheckout);
router.post('/', requireCustomerAuth, authenticatedCheckout);

export default router;
