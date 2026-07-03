import { Router } from 'express';
import {
  listPublicProducts,
  getPublicProductById,
} from '../../presentation/controllers/publicProductController';
import { getProductReviews } from '../../presentation/controllers/reviewController';

const router = Router();

router.get('/', listPublicProducts);
router.get('/:id/reviews', getProductReviews);
router.get('/:id', getPublicProductById);

export default router;
