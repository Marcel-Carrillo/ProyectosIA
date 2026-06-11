import { Request, Response, NextFunction } from 'express';
import { CategoryService } from '../../application/services/categoryService';
import { CategoryRepository } from '../../infrastructure/repositories/categoryRepository';
import { logger } from '../../infrastructure/logger';
import { CategoryCreateData, CategoryUpdateData } from '../../domain/repositories';

const categoryService = new CategoryService(new CategoryRepository());

export async function listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const includeInactive = req.query['includeInactive'] === 'true';
    const categories = await categoryService.findAll(includeInactive);
    logger.info('Categories listed', { count: categories.length, includeInactive });
    res.json({ success: true, data: categories, message: 'Categories retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getCategoryById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const category = await categoryService.findById(id);
    logger.info('Category retrieved', { categoryId: id });
    res.json({ success: true, data: category, message: 'Category retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const category = await categoryService.create(req.body as CategoryCreateData);
    logger.info('Category created', { categoryId: category.id, name: category.name });
    res.status(201).json({ success: true, data: category, message: 'Category created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const category = await categoryService.update(id, req.body as CategoryUpdateData);
    logger.info('Category updated', { categoryId: id });
    res.json({ success: true, data: category, message: 'Category updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const category = await categoryService.softDelete(id);
    logger.info('Category deactivated', { categoryId: id });
    res.json({ success: true, data: category, message: 'Category deactivated successfully' });
  } catch (err) {
    next(err);
  }
}
