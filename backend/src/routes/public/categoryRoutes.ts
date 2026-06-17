import { Router } from 'express';
import { listCategories } from '../../presentation/controllers/categoryController';

// Customer-facing categories for the storefront navigation.
// The Category model holds no supplier/internal data, so the existing
// listCategories controller (which returns only active categories by default)
// is safe to expose publicly.
const router = Router();

router.get('/', listCategories);

export default router;
