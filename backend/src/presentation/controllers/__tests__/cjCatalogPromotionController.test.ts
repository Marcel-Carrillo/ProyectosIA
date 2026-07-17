import { Request, Response, NextFunction } from 'express';

const mockPromote = jest.fn();
const mockActivate = jest.fn();
const mockDeactivate = jest.fn();
const mockRecategorize = jest.fn();

jest.mock('../../../application/services/cjCatalogPromotionService', () => ({
  CjCatalogPromotionService: jest.fn().mockImplementation(() => ({
    promote: mockPromote,
    activate: mockActivate,
    deactivate: mockDeactivate,
  })),
}));
jest.mock('../../../application/services/cjCategoryBackfillService', () => ({
  CjCategoryBackfillService: jest.fn().mockImplementation(() => ({
    recategorize: mockRecategorize,
  })),
}));

jest.mock('../../../infrastructure/repositories/cjCatalogItemRepository', () => ({
  CjCatalogItemRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/categoryRepository', () => ({
  CategoryRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/productRepository', () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/productVariantRepository', () => ({
  ProductVariantRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/productTranslationRepository', () => ({
  ProductTranslationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../application/services/productService', () => ({
  ProductService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/supplierIntegrationRepository', () => ({
  SupplierIntegrationRepository: jest.fn().mockImplementation(() => ({})),
}));

import { promote, activate, deactivate, recategorize } from '../cjCatalogPromotionController';

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

describe('cjCatalogPromotionController', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('promote', () => {
    it('should_return_201_when_at_least_one_item_was_created', async () => {
      mockPromote.mockResolvedValue({ products: [], variants: [], createdAny: true });
      const req = {
        params: { supplierId: '10' },
        body: { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }], categoryId: 1 },
      } as unknown as Request;
      const res = mockRes();

      await promote(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should_return_200_when_fully_idempotent', async () => {
      mockPromote.mockResolvedValue({ products: [], variants: [], createdAny: false });
      const req = {
        params: { supplierId: '10' },
        body: { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }], categoryId: 1 },
      } as unknown as Request;
      const res = mockRes();

      await promote(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should_call_next_with_the_promotion_validation_error_including_itemErrors', async () => {
      const err = Object.assign(new Error('failed'), {
        code: 'CJ_PROMOTION_VALIDATION_FAILED',
        status: 422,
        itemErrors: [{ cjCatalogItemId: 2, code: 'CJ_PROMOTION_PRICE_REQUIRED', message: 'price required' }],
      });
      mockPromote.mockRejectedValue(err);
      const req = {
        params: { supplierId: '10' },
        body: { items: [{ cjCatalogItemId: 2 }], categoryId: 1 },
      } as unknown as Request;

      await promote(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ itemErrors: err.itemErrors }));
    });

    it('should_call_next_with_validation_error_when_items_is_missing_without_calling_service', async () => {
      const req = { params: { supplierId: '10' }, body: { categoryId: 1 } } as unknown as Request;

      await promote(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
      expect(mockPromote).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('should_return_200_with_activation_result', async () => {
      mockActivate.mockResolvedValue({ productId: 20, productVariantId: 50 });
      const req = { params: { supplierId: '10', cjCatalogItemId: '1' } } as unknown as Request;
      const res = mockRes();

      await activate(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { productId: 20, productVariantId: 50 } })
      );
    });

    it('should_call_next_when_item_is_not_promoted', async () => {
      const err = Object.assign(new Error('not promoted'), { code: 'CJ_CATALOG_ITEM_NOT_PROMOTED', status: 422 });
      mockActivate.mockRejectedValue(err);
      const req = { params: { supplierId: '10', cjCatalogItemId: '1' } } as unknown as Request;

      await activate(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });

    it('should_call_next_with_validation_error_for_invalid_cjCatalogItemId_without_calling_service', async () => {
      const req = { params: { supplierId: '10', cjCatalogItemId: 'not-a-number' } } as unknown as Request;

      await activate(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
      expect(mockActivate).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('should_return_200_with_deactivation_result', async () => {
      mockDeactivate.mockResolvedValue({ productId: 20, productVariantId: 50 });
      const req = { params: { supplierId: '10', cjCatalogItemId: '1' } } as unknown as Request;
      const res = mockRes();

      await deactivate(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { productId: 20, productVariantId: 50 } })
      );
    });

    it('should_call_next_when_item_is_not_promoted', async () => {
      const err = Object.assign(new Error('not promoted'), { code: 'CJ_CATALOG_ITEM_NOT_PROMOTED', status: 422 });
      mockDeactivate.mockRejectedValue(err);
      const req = { params: { supplierId: '10', cjCatalogItemId: '1' } } as unknown as Request;

      await deactivate(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });

  describe('recategorize', () => {
    it('should_return_200_with_the_backfill_result', async () => {
      mockRecategorize.mockResolvedValue({
        fromCategoryId: 1,
        reassigned: [{ productId: 10, toCategoryId: 42 }],
        skipped: [{ productId: 11, reason: 'NO_CJ_CATEGORY_MAPPING' }],
        hasMore: false,
      });
      const req = { params: { supplierId: '10' }, query: {} } as unknown as Request;
      const res = mockRes();

      await recategorize(req, res, mockNext);

      expect(mockRecategorize).toHaveBeenCalledWith(10, undefined);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: {
            fromCategoryId: 1,
            reassigned: [{ productId: 10, toCategoryId: 42 }],
            skipped: [{ productId: 11, reason: 'NO_CJ_CATEGORY_MAPPING' }],
            hasMore: false,
          },
        })
      );
    });

    it('should_pass_a_query_limit_through_to_the_service', async () => {
      mockRecategorize.mockResolvedValue({ fromCategoryId: 1, reassigned: [], skipped: [], hasMore: true });
      const req = { params: { supplierId: '10' }, query: { limit: '50' } } as unknown as Request;

      await recategorize(req, mockRes(), mockNext);

      expect(mockRecategorize).toHaveBeenCalledWith(10, 50);
    });

    it('should_call_next_when_no_fallback_category_is_configured', async () => {
      const err = Object.assign(new Error('category required'), { code: 'CJ_PROMOTION_CATEGORY_REQUIRED', status: 422 });
      mockRecategorize.mockRejectedValue(err);
      const req = { params: { supplierId: '10' }, query: {} } as unknown as Request;

      await recategorize(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });

    it('should_call_next_with_validation_error_for_invalid_supplierId_without_calling_service', async () => {
      const req = { params: { supplierId: 'not-a-number' }, query: {} } as unknown as Request;

      await recategorize(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
      expect(mockRecategorize).not.toHaveBeenCalled();
    });
  });
});
