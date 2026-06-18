import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  adminLogin,
  adminLogout,
  adminMe,
  adminRefresh,
} from '../../presentation/controllers/adminAuthController';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.use(authLimiter);
router.post('/login', adminLogin);
router.post('/refresh', adminRefresh);
router.post('/logout', adminLogout);
router.get('/me', requireAdminAuth, adminMe);

export default router;
