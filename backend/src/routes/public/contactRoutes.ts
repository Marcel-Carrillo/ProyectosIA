import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { submitContact } from '../../presentation/controllers/contactController';

const router = Router();

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', contactLimiter, submitContact);

export default router;
