import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../../application/services/productService';
import { ProductRepository } from '../../infrastructure/repositories/productRepository';
import { ProductVariantRepository } from '../../infrastructure/repositories/productVariantRepository';
import { logger } from '../../infrastructure/logger';
import { ValidationError } from '../../application/validator';

function parseOptionalQueryInt(value: unknown, paramName: string): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    throw new ValidationError(`Query parameter '${paramName}' must be a valid integer`);
  }
  return parsed;
}

const productService = new ProductService(
  new ProductRepository(),
  new ProductVariantRepository(),
);

export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, categoryId, search, page, pageSize, sort, order } = req.query;
    const sortValue = sort === 'name' ? 'name' : sort === 'createdAt' ? 'createdAt' : undefined;
    const orderValue = order === 'asc' ? 'asc' : order === 'desc' ? 'desc' : undefined;
    const result = await productService.findAll({
      status: status as string | undefined,
      categoryId: parseOptionalQueryInt(categoryId, 'categoryId'),
      search: search as string | undefined,
      page: parseOptionalQueryInt(page, 'page'),
      pageSize: parseOptionalQueryInt(pageSize, 'pageSize'),
      sort: sortValue,
      order: orderValue,
    });
    logger.info('Products listed', { total: result.total, page: result.page });
    res.json({ success: true, data: result, message: 'Products retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const product = await productService.findById(id);
    logger.info('Product retrieved', { productId: id });
    res.json({ success: true, data: product, message: 'Product retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productService.create(req.body as Parameters<typeof productService.create>[0]);
    logger.info('Product created', { productId: product.id, slug: product.slug });
    res.status(201).json({ success: true, data: product, message: 'Product created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const product = await productService.update(id, req.body as Parameters<typeof productService.update>[1]);
    logger.info('Product updated', { productId: id });
    res.json({ success: true, data: product, message: 'Product updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    await productService.softDelete(id);
    logger.info('Product deleted', { productId: id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
