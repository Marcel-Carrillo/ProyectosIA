import { CjCatalogPromotionService } from '../cjCatalogPromotionService';
import { CjCatalogItem } from '../../../domain/models/cjCatalogItem';
import { ICjCatalogItemRepository } from '../../../domain/repositories/cjCatalogItemRepository';
import { ICategoryRepository } from '../../../domain/repositories';
import { IProductVariantRepository } from '../../../domain/repositories/productRepository';
import { ISupplierIntegrationRepository } from '../../../domain/repositories/supplierIntegrationRepository';
import { IAutomationSettingsRepository } from '../../../domain/repositories/automationSettingsRepository';
import { ICjClient } from '../../../infrastructure/external/cjTypes';
import { ProductVariant } from '../../../domain/models/productVariant';
import { Category } from '../../../domain/models';
import { SupplierIntegration } from '../../../domain/models/supplierIntegration';
import { ProductService } from '../productService';
import { SupplierIntegrationNotFoundError } from '../../../infrastructure/repositories/supplierIntegrationRepository';
import {
  CjCatalogItemNotPromotedError,
  CjPromotionValidationError,
  CjPromotionCategoryRequiredError,
  CjApiUnavailableError,
} from '../../validator';

const mockProductCreate = jest.fn();
const mockProductUpdate = jest.fn();
const mockVariantCreate = jest.fn();
const mockProductImageCreate = jest.fn();
const mockTransaction = jest.fn(async (cb: (tx: unknown) => unknown, _options?: { timeout?: number }) => {
  const tx = {
    product: { create: mockProductCreate, update: mockProductUpdate },
    productVariant: { create: mockVariantCreate },
    productImage: { create: mockProductImageCreate },
  };
  return cb(tx);
});

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...(args as [(tx: unknown) => unknown, { timeout?: number }?])),
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
  let settingsRepo: jest.Mocked<IAutomationSettingsRepository>;
  let cjClient: jest.Mocked<ICjClient>;
  let service: CjCatalogPromotionService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['CJ_DEFAULT_MARKUP_MULTIPLIER'];
    delete process.env['CJ_DEFAULT_CATEGORY_ID'];

    catalogRepo = {
      upsertMany: jest.fn(),
      reconcilePromotedVariantStock: jest.fn().mockResolvedValue({ deactivated: 0, reactivated: 0 }),
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
      findOrCreateByExternalRef: jest.fn(),
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
      findCjCatalogItemId: jest.fn(),
      updateShippingCostEstimate: jest.fn(),
      findManyByProductCategoryId: jest.fn(),
    };
    integrationRepo = {
      findBySupplierId: jest.fn(),
      upsert: jest.fn(),
      updateStatus: jest.fn(),
      updateLastSyncedAt: jest.fn(),
      updateCatalogSyncCursor: jest.fn(),
    };
    productService = {
      resolveUniqueSlug: jest.fn().mockResolvedValue('test-dress'),
      update: jest.fn(),
    };
    settingsRepo = {
      get: jest.fn().mockResolvedValue({
        id: 1,
        targetMargin: 5,
        defaultFreightDestinationCountry: 'ES',
        carrierAllowList: [],
      }),
      update: jest.fn(),
    };
    cjClient = {
      verifyConnection: jest.fn(),
      fetchCategories: jest.fn(),
      fetchCatalog: jest.fn(),
      fetchVariants: jest.fn(),
      calculateFreight: jest.fn(),
      createOrder: jest.fn(),
      getOrderDetail: jest.fn(),
      simulateSandboxAdvance: jest.fn(),
    };

    mockProductUpdate.mockResolvedValue({});
    mockProductImageCreate.mockResolvedValue({});

    integrationRepo.findBySupplierId.mockResolvedValue(new SupplierIntegration({ id: 7, supplierId: 3 }));
    categoryRepo.findById.mockResolvedValue(new Category({ id: 1, name: 'Dresses' }));
    variantRepo.findByCjCatalogItemId.mockResolvedValue(null);

    service = new CjCatalogPromotionService(
      catalogRepo,
      categoryRepo,
      productService as unknown as ProductService,
      variantRepo,
      integrationRepo,
      settingsRepo,
      cjClient
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
            stockQuantity: 5,
          }),
        })
      );
      expect(result.createdAny).toBe(true);
      expect(result.variants[0]).toMatchObject({ cjCatalogItemId: 1, productId: 20, productVariantId: 50, wasAlreadyPromoted: false });
    });

    it('should_raise_the_transaction_timeout_above_prismas_5s_default_for_large_batches', async () => {
      // Regression: Prisma's default interactive-transaction timeout (5000ms)
      // was observed live in production to abort promote() for a real batch of
      // ~300 items ("Transaction already closed" error) — the automated
      // auto-provisioning job can promote batches at that scale.
      const item = buildCatalogItem();
      catalogRepo.findManyByIds.mockResolvedValue([item]);
      mockProductCreate.mockResolvedValue({ id: 20 });
      mockVariantCreate.mockResolvedValue({ id: 50 });

      await service.promote(3, { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }], categoryId: 1 });

      const options = mockTransaction.mock.calls[0]?.[1] as { timeout?: number } | undefined;
      expect(options?.timeout).toBeGreaterThan(5000);
    });

    it('should_set_mainImageUrl_and_create_a_sortOrder_zero_image_when_a_new_product_has_a_product_image', async () => {
      const item = buildCatalogItem({ rawPayload: { product: { bigImage: 'https://img/p.jpg' }, variant: {} } });
      catalogRepo.findManyByIds.mockResolvedValue([item]);
      mockProductCreate.mockResolvedValue({ id: 20 });
      mockVariantCreate.mockResolvedValue({ id: 50 });

      await service.promote(3, { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }], categoryId: 1 });

      expect(mockProductUpdate).toHaveBeenCalledWith({ where: { id: 20 }, data: { mainImageUrl: 'https://img/p.jpg' } });
      expect(mockProductImageCreate).toHaveBeenCalledWith({
        data: { productId: 20, url: 'https://img/p.jpg', altText: 'Test Dress', sortOrder: 0, color: null },
      });
    });

    it('should_persist_the_variants_derived_color_on_its_image_record', async () => {
      const item = buildCatalogItem({
        rawPayload: { product: {}, variant: { variantImage: 'https://img/v.jpg', variantKey: 'Black-XXL' } },
      });
      catalogRepo.findManyByIds.mockResolvedValue([item]);
      mockProductCreate.mockResolvedValue({ id: 20 });
      mockVariantCreate.mockResolvedValue({ id: 50 });

      await service.promote(3, { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }], categoryId: 1 });

      expect(mockProductImageCreate).toHaveBeenCalledWith({
        data: { productId: 20, url: 'https://img/v.jpg', altText: 'Test Dress', sortOrder: 0, color: 'Black' },
      });
    });

    it('should_create_an_additional_image_for_a_variant_whose_image_differs_from_the_product_image', async () => {
      const item1 = buildCatalogItem({
        id: 1,
        externalRef: 'vid-1',
        vid: 'vid-1',
        rawPayload: { product: { bigImage: 'A' }, variant: {} },
      });
      const item2 = buildCatalogItem({
        id: 2,
        externalRef: 'vid-2',
        vid: 'vid-2',
        rawPayload: { product: {}, variant: { variantImage: 'B' } },
      });
      catalogRepo.findManyByIds.mockResolvedValue([item1, item2]);
      mockProductCreate.mockResolvedValue({ id: 20 });
      mockVariantCreate.mockResolvedValueOnce({ id: 51 }).mockResolvedValueOnce({ id: 52 });

      await service.promote(3, {
        items: [
          { cjCatalogItemId: 1, publicPrice: 39.99 },
          { cjCatalogItemId: 2, publicPrice: 39.99 },
        ],
        categoryId: 1,
      });

      expect(mockProductImageCreate).toHaveBeenCalledTimes(2);
      expect(mockProductImageCreate).toHaveBeenNthCalledWith(1, {
        data: { productId: 20, url: 'A', altText: 'Test Dress', sortOrder: 0, color: null },
      });
      expect(mockProductImageCreate).toHaveBeenNthCalledWith(2, {
        data: { productId: 20, url: 'B', altText: 'Test Dress', sortOrder: 1, color: null },
      });
    });

    it('should_set_mainImageUrl_from_the_first_variant_image_when_no_product_image_exists', async () => {
      // Regression: previously a product with only variant-level images ended
      // up with a ProductImage row but a permanently-null mainImageUrl.
      const item = buildCatalogItem({ rawPayload: { product: {}, variant: { variantImage: 'https://img/v.jpg' } } });
      catalogRepo.findManyByIds.mockResolvedValue([item]);
      mockProductCreate.mockResolvedValue({ id: 20 });
      mockVariantCreate.mockResolvedValue({ id: 50 });

      await service.promote(3, { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }], categoryId: 1 });

      expect(mockProductUpdate).toHaveBeenCalledWith({ where: { id: 20 }, data: { mainImageUrl: 'https://img/v.jpg' } });
      expect(mockProductImageCreate).toHaveBeenCalledWith({
        data: { productId: 20, url: 'https://img/v.jpg', altText: 'Test Dress', sortOrder: 0, color: null },
      });
    });

    it('should_not_duplicate_the_image_when_the_variant_image_exactly_matches_the_product_image', async () => {
      const item = buildCatalogItem({ rawPayload: { product: { bigImage: 'A' }, variant: { variantImage: 'A' } } });
      catalogRepo.findManyByIds.mockResolvedValue([item]);
      mockProductCreate.mockResolvedValue({ id: 20 });
      mockVariantCreate.mockResolvedValue({ id: 50 });

      await service.promote(3, { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }], categoryId: 1 });

      expect(mockProductImageCreate).toHaveBeenCalledTimes(1);
    });

    it('should_create_no_images_when_no_image_data_is_present', async () => {
      const item = buildCatalogItem();
      catalogRepo.findManyByIds.mockResolvedValue([item]);
      mockProductCreate.mockResolvedValue({ id: 20 });
      mockVariantCreate.mockResolvedValue({ id: 50 });

      const result = await service.promote(3, { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }], categoryId: 1 });

      expect(mockProductUpdate).not.toHaveBeenCalled();
      expect(mockProductImageCreate).not.toHaveBeenCalled();
      expect(result.createdAny).toBe(true);
    });

    it('should_never_copy_supplierCost_into_any_public_facing_field', async () => {
      const item = buildCatalogItem({ rawPayload: { product: { bigImage: 'A' }, variant: { variantImage: 'B' } } });
      catalogRepo.findManyByIds.mockResolvedValue([item]);
      mockProductCreate.mockResolvedValue({ id: 20 });
      mockVariantCreate.mockResolvedValue({ id: 50 });

      await service.promote(3, { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }], categoryId: 1 });

      expect(mockProductUpdate.mock.calls[0][0].data).not.toHaveProperty('supplierCost');
      for (const call of mockProductImageCreate.mock.calls) {
        expect(call[0].data).not.toHaveProperty('supplierCost');
      }
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
      // Idempotency guarantee for image capture: the re-promotion path never
      // enters the transaction's image-creation code at all (groups.size===0
      // here, so prisma.$transaction is never even called).
      expect(mockProductUpdate).not.toHaveBeenCalled();
      expect(mockProductImageCreate).not.toHaveBeenCalled();
    });

    it('should_join_the_existing_product_when_a_mixed_group_has_one_already_promoted_and_one_new_item', async () => {
      const item1 = buildCatalogItem({ id: 1, externalRef: 'vid-1', vid: 'vid-1' });
      const item2 = buildCatalogItem({
        id: 2,
        externalRef: 'vid-2',
        vid: 'vid-2',
        rawPayload: { product: {}, variant: { variantImage: 'https://img/v2.jpg' } },
      });
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
      // Deliberate scope cut (design.md D4 / tasks.md 6.2): image capture only
      // applies to brand-new products, not to a new variant joining an
      // already-existing product from a prior partial promotion — even though
      // item2 has a variantImage available, no image row is created for it.
      expect(mockProductImageCreate).not.toHaveBeenCalled();
    });

    it('should_auto_resolve_and_create_a_new_category_from_cj_taxonomy_when_no_categoryId_is_given', async () => {
      const item = buildCatalogItem({ categoryId: 'cj-ext-1' });
      catalogRepo.findManyByIds.mockResolvedValue([item]);
      cjClient.fetchCategories.mockResolvedValue([
        { categoryFirstName: 'Women', categoryFirstList: [{ categorySecondName: 'Dresses', categorySecondList: [{ categoryId: 'cj-ext-1', categoryName: 'Dresses' }] }] },
      ]);
      categoryRepo.findOrCreateByExternalRef.mockResolvedValue(new Category({ id: 42, name: 'Dresses', status: 'Inactive' }));
      mockProductCreate.mockResolvedValue({ id: 20 });
      mockVariantCreate.mockResolvedValue({ id: 50 });

      await service.promote(3, { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }] });

      expect(categoryRepo.findOrCreateByExternalRef).toHaveBeenCalledWith('CJDropshipping', 'cj-ext-1', 'Dresses');
      expect(mockProductCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ categoryId: 42 }) })
      );
    });

    it('should_let_an_explicit_categoryId_override_cj_resolution_and_never_call_fetchCategories', async () => {
      const item = buildCatalogItem({ categoryId: 'cj-ext-1' });
      catalogRepo.findManyByIds.mockResolvedValue([item]);
      mockProductCreate.mockResolvedValue({ id: 20 });
      mockVariantCreate.mockResolvedValue({ id: 50 });

      await service.promote(3, { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }], categoryId: 1 });

      expect(cjClient.fetchCategories).not.toHaveBeenCalled();
      expect(categoryRepo.findOrCreateByExternalRef).not.toHaveBeenCalled();
      expect(mockProductCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ categoryId: 1 }) })
      );
    });

    it('should_fall_back_to_CJ_DEFAULT_CATEGORY_ID_when_the_item_has_no_cj_category_id', async () => {
      process.env['CJ_DEFAULT_CATEGORY_ID'] = '7';
      const item = buildCatalogItem({ categoryId: null });
      catalogRepo.findManyByIds.mockResolvedValue([item]);
      categoryRepo.findById.mockImplementation(async (id: number) =>
        id === 7 ? new Category({ id: 7, name: 'Uncategorized' }) : null
      );
      mockProductCreate.mockResolvedValue({ id: 20 });
      mockVariantCreate.mockResolvedValue({ id: 50 });

      await service.promote(3, { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }] });

      expect(cjClient.fetchCategories).not.toHaveBeenCalled();
      expect(mockProductCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ categoryId: 7 }) })
      );
    });

    it('should_fall_back_to_CJ_DEFAULT_CATEGORY_ID_when_cj_resolution_fails', async () => {
      process.env['CJ_DEFAULT_CATEGORY_ID'] = '7';
      const item = buildCatalogItem({ categoryId: 'cj-ext-unresolvable' });
      catalogRepo.findManyByIds.mockResolvedValue([item]);
      cjClient.fetchCategories.mockRejectedValue(new Error('CJ API unavailable'));
      categoryRepo.findById.mockImplementation(async (id: number) =>
        id === 7 ? new Category({ id: 7, name: 'Uncategorized' }) : null
      );
      mockProductCreate.mockResolvedValue({ id: 20 });
      mockVariantCreate.mockResolvedValue({ id: 50 });

      await service.promote(3, { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }] });

      expect(categoryRepo.findOrCreateByExternalRef).not.toHaveBeenCalled();
      expect(mockProductCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ categoryId: 7 }) })
      );
    });

    it('should_throw_category_required_when_no_categoryId_no_cj_resolution_and_no_fallback_configured', async () => {
      const item = buildCatalogItem({ categoryId: null });
      catalogRepo.findManyByIds.mockResolvedValue([item]);
      mockProductCreate.mockResolvedValue({ id: 20 });

      let caught: CjPromotionCategoryRequiredError | undefined;
      try {
        await service.promote(3, { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }] });
      } catch (err) {
        caught = err as CjPromotionCategoryRequiredError;
      }
      expect(caught).toBeInstanceOf(CjPromotionCategoryRequiredError);
      // itemErrors is populated so a retrying caller (providerRegistry) can
      // exclude exactly this item — see the mixed-outcome test below.
      expect(caught?.itemErrors).toEqual([
        { cjCatalogItemId: 1, code: 'CJ_PROMOTION_CATEGORY_REQUIRED', message: expect.any(String) },
      ]);
      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockProductCreate).not.toHaveBeenCalled();
    });

    it('should_report_itemErrors_only_for_the_pid_group_that_failed_when_another_group_resolves', async () => {
      // Regression (adversarial-review Blocker finding): a single poison
      // pid-group used to throw a bare CjPromotionCategoryRequiredError with
      // no way to identify which item(s) were the problem, so a retrying
      // caller had no way to exclude just the offender — this asserts the
      // resolvable group's item is NOT included in itemErrors, only the
      // unresolvable group's item is.
      const resolvable = buildCatalogItem({ id: 1, pid: 'pid-1', externalRef: 'vid-1', vid: 'vid-1', categoryId: 'cj-ext-1' });
      const unresolvable = buildCatalogItem({ id: 2, pid: 'pid-2', externalRef: 'vid-2', vid: 'vid-2', categoryId: null });
      catalogRepo.findManyByIds.mockResolvedValue([resolvable, unresolvable]);
      cjClient.fetchCategories.mockResolvedValue([
        { categoryFirstName: 'Women', categoryFirstList: [{ categorySecondName: 'Dresses', categorySecondList: [{ categoryId: 'cj-ext-1', categoryName: 'Dresses' }] }] },
      ]);
      categoryRepo.findOrCreateByExternalRef.mockResolvedValue(new Category({ id: 42, name: 'Dresses', status: 'Inactive' }));

      let caught: CjPromotionCategoryRequiredError | undefined;
      try {
        await service.promote(3, {
          items: [
            { cjCatalogItemId: 1, publicPrice: 39.99 },
            { cjCatalogItemId: 2, publicPrice: 49.99 },
          ],
        });
      } catch (err) {
        caught = err as CjPromotionCategoryRequiredError;
      }
      expect(caught).toBeInstanceOf(CjPromotionCategoryRequiredError);
      expect(caught?.itemErrors).toEqual([
        { cjCatalogItemId: 2, code: 'CJ_PROMOTION_CATEGORY_REQUIRED', message: expect.any(String) },
      ]);
      // Whole call still aborts (nothing persisted) — the caller is
      // responsible for retrying excluding item 2, matching the existing
      // price-validation contract.
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should_call_fetchCategories_exactly_once_even_when_multiple_pid_groups_need_auto_resolution', async () => {
      const item1 = buildCatalogItem({ id: 1, pid: 'pid-1', externalRef: 'vid-1', vid: 'vid-1', categoryId: 'cj-ext-1' });
      const item2 = buildCatalogItem({ id: 2, pid: 'pid-2', externalRef: 'vid-2', vid: 'vid-2', categoryId: 'cj-ext-2' });
      catalogRepo.findManyByIds.mockResolvedValue([item1, item2]);
      cjClient.fetchCategories.mockResolvedValue([
        {
          categoryFirstName: 'Women',
          categoryFirstList: [
            { categorySecondName: 'Dresses', categorySecondList: [{ categoryId: 'cj-ext-1', categoryName: 'Dresses' }] },
            { categorySecondName: 'Shoes', categorySecondList: [{ categoryId: 'cj-ext-2', categoryName: 'Shoes' }] },
          ],
        },
      ]);
      categoryRepo.findOrCreateByExternalRef
        .mockResolvedValueOnce(new Category({ id: 42, name: 'Dresses', status: 'Inactive' }))
        .mockResolvedValueOnce(new Category({ id: 43, name: 'Shoes', status: 'Inactive' }));
      mockProductCreate.mockResolvedValueOnce({ id: 20 }).mockResolvedValueOnce({ id: 21 });
      mockVariantCreate.mockResolvedValueOnce({ id: 50 }).mockResolvedValueOnce({ id: 51 });

      await service.promote(3, {
        items: [
          { cjCatalogItemId: 1, publicPrice: 39.99 },
          { cjCatalogItemId: 2, publicPrice: 49.99 },
        ],
      });

      expect(cjClient.fetchCategories).toHaveBeenCalledTimes(1);
      expect(categoryRepo.findOrCreateByExternalRef).toHaveBeenCalledTimes(2);
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

  describe('estimateFreight', () => {
    it('should_return_shipping_cost_and_a_rounded_suggested_price_using_cost_plus_shipping', async () => {
      catalogRepo.findById.mockResolvedValue(buildCatalogItem({ supplierCost: '10.00' }));
      cjClient.calculateFreight.mockResolvedValue([
        { logisticName: 'CJPacket', logisticAging: '7-12', logisticPrice: 3.42, totalPostageFee: 3.42 },
        { logisticName: 'DHL', logisticAging: '3-5', logisticPrice: 8.0, totalPostageFee: 8.0 },
      ]);

      const result = await service.estimateFreight(3, 1);

      expect(cjClient.calculateFreight).toHaveBeenCalledWith({
        startCountryCode: 'CN',
        endCountryCode: 'ES',
        products: [{ vid: 'vid-1', quantity: 1 }],
      });
      expect(result.shippingCostEstimate).toBe(3.42);
      // cost 10 + shipping 3.42 = 13.42 -> rounded up to next ",99" ending
      expect(result.suggestedPublicPrice).toBe(13.99);
    });

    it('should_apply_the_configured_default_markup_before_rounding_when_set', async () => {
      process.env['CJ_DEFAULT_MARKUP_MULTIPLIER'] = '2';
      catalogRepo.findById.mockResolvedValue(buildCatalogItem({ supplierCost: '10.00' }));
      cjClient.calculateFreight.mockResolvedValue([
        { logisticName: 'CJPacket', logisticAging: '7-12', logisticPrice: 3.0, totalPostageFee: 3.0 },
      ]);

      const result = await service.estimateFreight(3, 1);

      // (10 * 2) + 3 = 23 -> rounds up to the next whole unit's ",99" ending
      expect(result.suggestedPublicPrice).toBe(23.99);
    });

    it('should_reject_when_supplier_has_no_integration', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(null);

      await expect(service.estimateFreight(3, 1)).rejects.toThrow(SupplierIntegrationNotFoundError);
    });

    it('should_reject_when_item_not_found_for_supplier', async () => {
      catalogRepo.findById.mockResolvedValue(null);

      await expect(service.estimateFreight(3, 1)).rejects.toThrow(CjCatalogItemNotPromotedError);
    });

    it('should_wrap_cj_client_failures_in_CjApiUnavailableError', async () => {
      catalogRepo.findById.mockResolvedValue(buildCatalogItem());
      cjClient.calculateFreight.mockRejectedValue(new Error('network error'));

      await expect(service.estimateFreight(3, 1)).rejects.toThrow(CjApiUnavailableError);
    });

    it('should_reject_when_cj_returns_no_freight_options', async () => {
      catalogRepo.findById.mockResolvedValue(buildCatalogItem());
      cjClient.calculateFreight.mockResolvedValue([]);

      await expect(service.estimateFreight(3, 1)).rejects.toThrow(CjApiUnavailableError);
    });
  });
});
