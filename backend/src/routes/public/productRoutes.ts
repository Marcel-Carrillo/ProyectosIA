import { Router } from 'express';
import {
  listPublicProducts,
  getPublicProductById,
} from '../../presentation/controllers/publicProductController';

const router = Router();

router.get('/', listPublicProducts);
router.get('/:id', getPublicProductById);

export default router;
