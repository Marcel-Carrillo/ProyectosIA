import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  listOrders,
  getOrderById,
  setup2fa,
  confirm2fa,
  disable2fa,
} from '../../presentation/controllers/customerAccountController';
import {
  listWishlist,
  addWishlistItem,
  removeWishlistItem,
} from '../../presentation/controllers/wishlistController';
import { requireCustomerAuth } from '../../middleware/requireCustomerAuth';

const router = Router();

router.use(requireCustomerAuth);

router.get('/profile', getProfile);
router.patch('/profile', updateProfile);
router.get('/orders', listOrders);
router.get('/orders/:id', getOrderById);

router.post('/security/2fa/setup', setup2fa);
router.post('/security/2fa/confirm', confirm2fa);
router.post('/security/2fa/disable', disable2fa);

router.get('/wishlist', listWishlist);
router.post('/wishlist', addWishlistItem);
router.delete('/wishlist/:productVariantId', removeWishlistItem);

export default router;
