import { CjCatalogPromotionService } from '../cjCatalogPromotionService';
import { CjCatalogItem } from '../../../domain/models/cjCatalogItem';
import { ICjCatalogItemRepository } from '../../../domain/repositories/cjCatalogItemRepository';
import { ICategoryRepository } from '../../../domain/repositories';
import { IProductVariantRepository } from '../../../domain/repositories/productRepository';
import { ISupplierIntegrationRepository } from '../../../domain/repositories/supplierIntegrationRepository';
import { ProductVariant } from '../../../domain/models/productVariant';
import { Category } from '../../../domain/models';
import { SupplierIntegration } from '../../../domain/models/supplierIntegration';
import { ProductService } from '../productService';
import { SupplierIntegrationNotFoundError } from '../../../infrastructure/repositories/supplierIntegrationRepository';
import { CjCatalogItemNotPromotedError, CjPromotionValidationError } from '../../validator';

const mockProductCreate = jest.fn();
const mockVariantCreate = jest.fn();
const mockTransaction = jest.fn(async (cb: (tx: unknown) => unknown) => {
  const tx = {
    product: { create: mockProductCreate },
    productVariant: { create: mockVariantCreate },
  };
  return cb(tx);
});

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...(args as [(tx: unknown) => unknown])),
  },
}));

function buildCatalogItem(overrides: Partial<ConstructorParameters<typeof CjCatalogItem>[0]> = {}): CjCatalogItem {
  return new CjCatalogItem({
    id: 1,
    supplierIntegrationId: 7,
    externalRef: 'vid-1',
    pid: 'pid-1',
    vid: 'vid-1',
    title: 'Test Dress',
    size: 'M',
    color: 'Black',
    supplierCost: '10.00',
    stockQuantity: 5,
    rawPayload: {},
    syncStatus: 'Synced',
    ...overrides,
  });
}

function buildVariant(overrides: Partial<ConstructorParameters<typeof ProductVariant>[0]> = {}): ProductVariant {
  return new ProductVariant({
    id: 50,
    productId: 20,
    sku: 'CJ-vid-1',
    publicPrice: 29.99,
    stockPolicy: 'SupplierManaged',
    status: 'Inactive',
    ...overrides,
  });
}

describe('CjCatalogPromotionService', () => {
  let catalogRepo: jest.Mocked<ICjCatalogItemRepository>;
  let categoryRepo: jest.Mocked<ICategoryRepository>;
  let variantRepo: jest.Mocked<IProductVariantRepository>;
  let integrationRepo: jest.Mocked<ISupplierIntegrationRepository>;
  let productService: { resolveUniqueSlug: jest.Mock; update: jest.Mock };
  let service: CjCatalogPromotionService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['CJ_DEFAULT_MARKUP_MULTIPLIER'];

    catalogRepo = {
      upsertMany: jest.fn(),
      findBySupplierIntegrationId: jest.fn(),
      findByExternalRef: jest.fn(),
      findById: jest.fn(),
      findManyByIds: jest.fn(),
    };
    categoryRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };
    variantRepo = {
      findByProduct: jest.fn(),
      findById: jest.fn(),
      findBySku: jest.fn(),
      findByCjCatalogItemId: jest.fn(),
      countActiveByProduct: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };
    integrationRepo = {
      findBySupplierId: jest.fn(),
      upsert: jest.fn(),
      updateStatus: jest.fn(),
      updateLastSyncedAt: jest.fn(),
    };
    productService = {
      resolveUniqueSlug: jest.fn().mockResolvedValue('test-dress'),
      update: jest.fn(),
    };

    integrationRepo.findBySupplierId.mockResolvedValue(new SupplierIntegration({ id: 7, supplierId: 3 }));
    categoryRepo.findById.mockResolvedValue(new Category({ id: 1, name: 'Dresses' }));
    variantRepo.findByCjCatalogItemId.mockResolvedValue(null);

    service = new CjCatalogPromotionService(
      catalogRepo,
      categoryRepo,
      productService as unknown as ProductService,
      variantRepo,
      integrationRepo
    );
  });

  describe('promote', () => {
    it('should_create_one_product_and_one_variant_for_a_single_item_with_explicit_price', async () => {
      const item = buildCatalogItem();
      catalogRepo.findManyByIds.mockResolvedValue([item]);
      mockProductCreate.mockResolvedValue({ id: 20 });
      mockVariantCreate.mockResolvedValue({ id: 50 });

      const result = await service.promote(3, {
        items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }],
        categoryId: 1,
      });

      expect(mockProductCreate).toHaveBeenCalledTimes(1);
      expect(mockVariantCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 20,
            sku: 'CJ-vid-1',
            publicPrice: 39.99,
            cjCatalogItemId: 1,
          }),
        })
      );
      expect(result.createdAny).toBe(true);
      expect(result.variants[0]).toMatchObject({ cjCatalogItemId: 1, productId: 20, productVariantId: 50, wasAlreadyPromoted: false });
    });

    it('should_group_items_sharing_the_same_pid_into_a_single_product', async () => {
      const item1 = buildCatalogItem({ id: 1, externalRef: 'vid-1', vid: 'vid-1' });
      const item2 = buildCatalogItem({ id: 2, externalRef: 'vid-2', vid: 'vid-2' });
      const item3 = buildCatalogItem({ id: 3, externalRef: 'vid-3', vid: 'vid-3' });
      catalogRepo.findManyByIds.mockResolvedValue([item1, item2, item3]);
      mockProductCreate.mockResolvedValue({ id: 20 });
      mockVariantCreate
        .mockResolvedValueOnce({ id: 51 })
        .mockResolvedValueOnce({ id: 52 })
        .mockResolvedValueOnce({ id: 53 });

      const result = await service.promote(3, {
        items: [
          { cjCatalogItemId: 1, publicPrice: 39.99 },
          { cjCatalogItemId: 2, publicPrice: 39.99 },
          { cjCatalogItemId: 3, publicPrice: 39.99 },
        ],
        categoryId: 1,
      });

      expect(mockProductCreate).toHaveBeenCalledTimes(1);
      expect(mockVariantCreate).toHaveBeenCalledTimes(3);
      expect(result.products).toEqual([{ productId: 20, variantIds: [51, 52, 53] }]);
    });

    it('should_fallback_to_default_markup_multiplier_when_no_explicit_price_given', async () => {
      process.env['CJ_DEFAULT_MARKUP_MULTIPLIER'] = '2.5';
      const item = buildCatalogItem({ supplierCost: '10.00' });
      catalogRepo.findManyByIds.mockResolvedValue([item]);
      mockProductCreate.mockResolvedValue({ id: 20 });
      mockVariantCreate.mockResolvedValue({ id: 50 });

      await service.promote(3, { items: [{ cjCatalogItemId: 1 }], categoryId: 1 });

      expect(mockVariantCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ publicPrice: 25 }) })
      );
    });

    it('should_reject_with_price_required_when_no_price_and_no_configured_markup', async () => {
      const item = buildCatalogItem();
      catalogRepo.findManyByIds.mockResolvedValue([item]);

      await expect(
        service.promote(3, { items: [{ cjCatalogItemId: 1 }], categoryId: 1 })
      ).rejects.toThrow(CjPromotionValidationError);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should_reject_with_category_required_when_categoryId_does_not_resolve', async () => {
      categoryRepo.findById.mockResolvedValue(null);
      const item = buildCatalogItem();
      catalogRepo.findManyByIds.mockResolvedValue([item]);

      await expect(
        service.promote(3, { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }], categoryId: 999 })
      ).rejects.toThrow('categoryId');
      expect(catalogRepo.findManyByIds).not.toHaveBeenCalled();
    });

    it('should_reject_items_with_Failed_syncStatus', async () => {
      const item = buildCatalogItem({ syncStatus: 'Failed' });
      catalogRepo.findManyByIds.mockResolvedValue([item]);

      let caught: CjPromotionValidationError | undefined;
      try {
        await service.promote(3, { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }], categoryId: 1 });
      } catch (err) {
        caught = err as CjPromotionValidationError;
      }
      expect(caught).toBeInstanceOf(CjPromotionValidationError);
      expect(caught?.itemErrors[0]?.code).toBe('CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE');
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should_persist_nothing_when_one_item_in_a_bulk_request_is_unknown', async () => {
      const item = buildCatalogItem({ id: 1 });
      catalogRepo.findManyByIds.mockResolvedValue([item]); // id 2 not returned = unknown

      let caught: CjPromotionValidationError | undefined;
      try {
        await service.promote(3, {
          items: [
            { cjCatalogItemId: 1, publicPrice: 39.99 },
            { cjCatalogItemId: 2, publicPrice: 39.99 },
          ],
          categoryId: 1,
        });
      } catch (err) {
        caught = err as CjPromotionValidationError;
      }
      expect(caught).toBeInstanceOf(CjPromotionValidationError);
      expect(caught?.itemErrors).toEqual([
        { cjCatalogItemId: 2, code: 'CJ_CATALOG_ITEM_NOT_FOUND', message: expect.any(String) },
      ]);
      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockProductCreate).not.toHaveBeenCalled();
    });

    it('should_be_idempotent_when_item_is_already_promoted', async () => {
      const item = buildCatalogItem();
      catalogRepo.findManyByIds.mockResolvedValue([item]);
      variantRepo.findByCjCatalogItemId.mockResolvedValue(buildVariant({ id: 50, productId: 20 }));

      const result = await service.promote(3, {
        items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }],
        categoryId: 1,
      });

      expect(mockProductCreate).not.toHaveBeenCalled();
      expect(mockVariantCreate).not.toHaveBeenCalled();
      expect(result.createdAny).toBe(false);
      expect(result.variants[0]).toMatchObject({ cjCatalogItemId: 1, productId: 20, productVariantId: 50, wasAlreadyPromoted: true });
    });

    it('should_join_the_existing_product_when_a_mixed_group_has_one_already_promoted_and_one_new_item', async () => {
      const item1 = buildCatalogItem({ id: 1, externalRef: 'vid-1', vid: 'vid-1' });
      const item2 = buildCatalogItem({ id: 2, externalRef: 'vid-2', vid: 'vid-2' });
      catalogRepo.findManyByIds.mockResolvedValue([item1, item2]);
      variantRepo.findByCjCatalogItemId.mockImplementation(async (id: number) =>
        id === 1 ? buildVariant({ id: 50, productId: 20 }) : null
      );
      mockVariantCreate.mockResolvedValue({ id: 51 });

      const result = await service.promote(3, {
        items: [
          { cjCatalogItemId: 1, publicPrice: 39.99 },
          { cjCatalogItemId: 2, publicPrice: 39.99 },
        ],
        categoryId: 1,
      });

      expect(mockProductCreate).not.toHaveBeenCalled();
      expect(mockVariantCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ productId: 20 }) })
      );
      expect(result.variants).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cjCatalogItemId: 1, wasAlreadyPromoted: true, productId: 20 }),
          expect.objectContaining({ cjCatalogItemId: 2, wasAlreadyPromoted: false, productId: 20 }),
        ])
      );
    });
  });

  describe('activate', () => {
    it('should_activate_variant_before_updating_parent_product_status', async () => {
      const callOrder: string[] = [];
      catalogRepo.findById.mockResolvedValue(buildCatalogItem());
      variantRepo.findByCjCatalogItemId.mockResolvedValue(buildVariant({ id: 50, productId: 20, status: 'Inactive' }));
      variantRepo.update.mockImplementation(async (...args) => {
        callOrder.push('variant.update');
        return buildVariant({ id: args[0] as number, productId: 20, status: 'Active' });
      });
      productService.update.mockImplementation(async () => {
        callOrder.push('product.update');
      });

      const result = await service.activate(3, 1);

      expect(callOrder).toEqual(['variant.update', 'product.update']);
      expect(variantRepo.update).toHaveBeenCalledWith(50, { status: 'Active' });
      expect(productService.update).toHaveBeenCalledWith(20, { status: 'Active' });
      expect(result).toEqual({ productId: 20, productVariantId: 50 });
    });

    it('should_reject_when_item_has_no_linked_variant', async () => {
      catalogRepo.findById.mockResolvedValue(buildCatalogItem());
      variantRepo.findByCjCatalogItemId.mockResolvedValue(null);

      await expect(service.activate(3, 1)).rejects.toThrow(CjCatalogItemNotPromotedError);
    });

    it('should_reject_when_supplier_has_no_integration', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(null);

      await expect(service.activate(3, 1)).rejects.toThrow(SupplierIntegrationNotFoundError);
    });
  });

  describe('deactivate', () => {
    it('should_set_variant_inactive_without_calling_productService_update', async () => {
      catalogRepo.findById.mockResolvedValue(buildCatalogItem());
      variantRepo.findByCjCatalogItemId.mockResolvedValue(buildVariant({ id: 50, productId: 20, status: 'Active' }));
      variantRepo.update.mockResolvedValue(buildVariant({ id: 50, productId: 20, status: 'Inactive' }));

      const result = await service.deactivate(3, 1);

      expect(variantRepo.update).toHaveBeenCalledWith(50, { status: 'Inactive' });
      expect(productService.update).not.toHaveBeenCalled();
      expect(result).toEqual({ productId: 20, productVariantId: 50 });
    });

    it('should_reject_when_item_has_no_linked_variant', async () => {
      catalogRepo.findById.mockResolvedValue(buildCatalogItem());
      variantRepo.findByCjCatalogItemId.mockResolvedValue(null);

      await expect(service.deactivate(3, 1)).rejects.toThrow(CjCatalogItemNotPromotedError);
    });
  });
});
