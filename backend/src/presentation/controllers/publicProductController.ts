import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../../application/services/productService';
import {
  ProductRepository,
  ProductNotFoundError,
} from '../../infrastructure/repositories/productRepository';
import { ProductVariantRepository } from '../../infrastructure/repositories/productVariantRepository';
import { logger } from '../../infrastructure/logger';
import { ValidationError } from '../../application/validator';
import { serializePublicProduct } from '../serializers/publicProduct';

const MAX_PAGE_SIZE = 100;

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

export async function listPublicProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { categoryId, search, page, pageSize, sort, order } = req.query;
    const sortValue = sort === 'name' ? 'name' : sort === 'createdAt' ? 'createdAt' : undefined;
    const orderValue = order === 'asc' ? 'asc' : order === 'desc' ? 'desc' : undefined;

    const requestedPageSize = parseOptionalQueryInt(pageSize, 'pageSize');
    const boundedPageSize =
      requestedPageSize !== undefined ? Math.min(requestedPageSize, MAX_PAGE_SIZE) : undefined;

    // Public listing always restricts to Active products; any client-supplied status is ignored.
    const result = await productService.findAll({
      status: 'Active',
      categoryId: parseOptionalQueryInt(categoryId, 'categoryId'),
      search: search as string | undefined,
      page: parseOptionalQueryInt(page, 'page'),
      pageSize: boundedPageSize,
      sort: sortValue,
      order: orderValue,
    });

    const data = {
      items: result.items.map(serializePublicProduct),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };

    logger.info('Public products listed', { total: result.total, page: result.page });
    res.json({ success: true, data, message: 'Products retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getPublicProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseOptionalQueryInt(req.params['id'], 'id');
    if (id === undefined) {
      throw new ValidationError("Parameter 'id' must be a valid integer");
    }

    const product = await productService.findById(id);

    // Non-active products are not visible through the public catalog.
    if (product.status !== 'Active') {
      throw new ProductNotFoundError();
    }

    logger.info('Public product retrieved', { productId: id });
    res.json({ success: true, data: serializePublicProduct(product), message: 'Product retrieved successfully' });
  } catch (err) {
    next(err);
  }
}
