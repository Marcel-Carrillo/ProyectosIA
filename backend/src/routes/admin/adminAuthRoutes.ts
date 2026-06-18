import { Router } from 'express';
import {
  adminLogin,
  adminLogout,
  adminMe,
  adminRefresh,
} from '../../presentation/controllers/adminAuthController';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';

const router = Router();

router.post('/login', adminLogin);
router.post('/refresh', adminRefresh);
router.post('/logout', adminLogout);
router.get('/me', requireAdminAuth, adminMe);

export default router;
