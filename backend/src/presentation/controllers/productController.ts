import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../../application/services/productService';
import { ProductRepository } from '../../infrastructure/repositories/productRepository';
import { ProductVariantRepository } from '../../infrastructure/repositories/productVariantRepository';
import { logger } from '../../infrastructure/logger';

const productService = new ProductService(
  new ProductRepository(),
  new ProductVariantRepository(),
);

export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, categoryId, search, page, pageSize } = req.query;
    const result = await productService.findAll({
      status: status as string | undefined,
      categoryId: categoryId ? parseInt(categoryId as string, 10) : undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string, 10) : undefined,
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
