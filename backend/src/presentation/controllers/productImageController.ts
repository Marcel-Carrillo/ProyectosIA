import { Request, Response, NextFunction } from 'express';
import { ProductImageService } from '../../application/services/productImageService';
import { ProductRepository } from '../../infrastructure/repositories/productRepository';
import { ProductImageRepository } from '../../infrastructure/repositories/productImageRepository';
import { logger } from '../../infrastructure/logger';
import { ProductImageCreateData, ProductImageUpdateData } from '../../domain/repositories/productRepository';

const imageService = new ProductImageService(
  new ProductImageRepository(),
  new ProductRepository(),
);

export async function listImages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseInt(req.params['id'] as string, 10);
    const images = await imageService.listByProduct(productId);
    logger.info('Images listed', { productId, count: images.length });
    res.json({ success: true, data: images, message: 'Images retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function addImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseInt(req.params['id'] as string, 10);
    const body = req.body as Omit<ProductImageCreateData, 'productId'>;
    const image = await imageService.add({ ...body, productId });
    logger.info('Image added', { productId, imageId: image.id });
    res.status(201).json({ success: true, data: image, message: 'Image added successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseInt(req.params['id'] as string, 10);
    const imageId = parseInt(req.params['imageId'] as string, 10);
    const image = await imageService.update(productId, imageId, req.body as ProductImageUpdateData);
    logger.info('Image updated', { productId, imageId });
    res.json({ success: true, data: image, message: 'Image updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseInt(req.params['id'] as string, 10);
    const imageId = parseInt(req.params['imageId'] as string, 10);
    await imageService.remove(productId, imageId);
    logger.info('Image deleted', { productId, imageId });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
