import { Request, Response, NextFunction } from 'express';
import { ProductVariantService } from '../../application/services/productVariantService';
import { ProductRepository } from '../../infrastructure/repositories/productRepository';
import { ProductVariantRepository } from '../../infrastructure/repositories/productVariantRepository';
import { logger } from '../../infrastructure/logger';
import { ProductVariantCreateData, ProductVariantUpdateData } from '../../domain/repositories/productRepository';

const variantService = new ProductVariantService(
  new ProductVariantRepository(),
  new ProductRepository(),
);

export async function listVariants(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseInt(req.params['id'] as string, 10);
    const variants = await variantService.listByProduct(productId);
    logger.info('Variants listed', { productId, count: variants.length });
    res.json({ success: true, data: variants, message: 'Variants retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getVariantById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseInt(req.params['id'] as string, 10);
    const variantId = parseInt(req.params['variantId'] as string, 10);
    const variant = await variantService.findById(productId, variantId);
    logger.info('Variant retrieved', { productId, variantId });
    res.json({ success: true, data: variant, message: 'Variant retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseInt(req.params['id'] as string, 10);
    const body = req.body as Omit<ProductVariantCreateData, 'productId'>;
    const variant = await variantService.create({ ...body, productId });
    logger.info('Variant created', { productId, variantId: variant.id, sku: variant.sku });
    res.status(201).json({ success: true, data: variant, message: 'Variant created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseInt(req.params['id'] as string, 10);
    const variantId = parseInt(req.params['variantId'] as string, 10);
    const variant = await variantService.update(productId, variantId, req.body as ProductVariantUpdateData);
    logger.info('Variant updated', { productId, variantId });
    res.json({ success: true, data: variant, message: 'Variant updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseInt(req.params['id'] as string, 10);
    const variantId = parseInt(req.params['variantId'] as string, 10);
    await variantService.softDelete(productId, variantId);
    logger.info('Variant deleted', { productId, variantId });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
