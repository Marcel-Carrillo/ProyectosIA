import { Router } from 'express';
import {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../presentation/controllers/categoryController';

// Admin-only category management. Mounted under /api/admin/categories behind
// requireAdminAuth — category writes must never be reachable without auth.
// The storefront reads categories through /api/public/categories (GET only).
const router = Router();

router.get('/', listCategories);
router.get('/:id', getCategoryById);
router.post('/', createCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;
