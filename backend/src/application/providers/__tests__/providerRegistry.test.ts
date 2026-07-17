const mockVerifyConnection = jest.fn();
const mockSyncCatalog = jest.fn();
const mockListStagedCatalog = jest.fn();
const mockPromote = jest.fn();

jest.mock('../../services/cjConnectionService', () => ({
  CjConnectionService: jest.fn().mockImplementation(() => ({ verifyConnection: mockVerifyConnection })),
}));
jest.mock('../../services/cjCatalogSyncService', () => ({
  CjCatalogSyncService: jest.fn().mockImplementation(() => ({
    syncCatalog: mockSyncCatalog,
    listStagedCatalog: mockListStagedCatalog,
  })),
}));
jest.mock('../../services/cjCatalogPromotionService', () => ({
  CjCatalogPromotionService: jest.fn().mockImplementation(() => ({ promote: mockPromote })),
}));
jest.mock('../../services/productService', () => ({
  ProductService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/supplierIntegrationRepository', () => ({
  SupplierIntegrationRepository: jest.fn().mockImplementation(() => ({})),
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
jest.mock('../../../infrastructure/external/cjClient', () => ({
  cjClient: {},
  CJ_PLACEHOLDER_API_KEY: 'cj_test_placeholder',
}));

import { cjProviderDescriptor, providerRegistry } from '../providerRegistry';
import { CjPromotionCategoryRequiredError, CjPromotionValidationError } from '../../validator';

describe('providerRegistry', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env['CJDROPSHIPPING_API_KEY'];
    delete process.env['CJ_DEFAULT_CATEGORY_ID'];
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('isConfigured', () => {
    it('should_report_configured_when_api_key_is_a_real_value', () => {
      process.env['CJDROPSHIPPING_API_KEY'] = 'real_key_123';
      expect(cjProviderDescriptor.isConfigured()).toBe(true);
    });

    it('should_report_not_configured_when_api_key_is_missing', () => {
      expect(cjProviderDescriptor.isConfigured()).toBe(false);
    });

    it('should_report_not_configured_when_api_key_is_the_placeholder_value', () => {
      process.env['CJDROPSHIPPING_API_KEY'] = 'cj_test_placeholder';
      expect(cjProviderDescriptor.isConfigured()).toBe(false);
    });

    it('should_report_not_configured_when_api_key_is_an_empty_string', () => {
      process.env['CJDROPSHIPPING_API_KEY'] = '';
      expect(cjProviderDescriptor.isConfigured()).toBe(false);
    });
  });

  describe('descriptor shape', () => {
    it('should_expose_key_and_defaultSupplierName', () => {
      expect(cjProviderDescriptor.key).toBe('CJDropshipping');
      expect(cjProviderDescriptor.defaultSupplierName).toBe('CJ Dropshipping');
    });

    it('should_export_a_registry_containing_exactly_the_cj_descriptor', () => {
      expect(providerRegistry).toEqual([cjProviderDescriptor]);
    });
  });

  describe('runPipeline', () => {
    it('should_skip_sync_and_promote_when_verify_reports_unhealthy', async () => {
      mockVerifyConnection.mockResolvedValue({ healthy: false });

      const result = await cjProviderDescriptor.runPipeline(1);

      expect(result).toEqual({
        verifyHealthy: false,
        itemsUpserted: 0,
        itemsFailed: 0,
        variantsCreated: 0,
        alreadyPromoted: 0,
      });
      expect(mockSyncCatalog).not.toHaveBeenCalled();
      expect(mockPromote).not.toHaveBeenCalled();
    });

    it('should_page_through_listStagedCatalog_until_a_short_page_and_then_call_promote_once', async () => {
      mockVerifyConnection.mockResolvedValue({ healthy: true });
      mockSyncCatalog.mockResolvedValue({ itemsUpserted: 150, itemsFailed: 0, syncedAt: new Date() });

      const fullPage = Array.from({ length: 100 }, (_, i) => ({
        item: { id: i + 1 },
        promotionState: 'NotPromoted',
        productId: null,
        productVariantId: null,
      }));
      const shortPage = Array.from({ length: 5 }, (_, i) => ({
        item: { id: 101 + i },
        promotionState: 'NotPromoted',
        productId: null,
        productVariantId: null,
      }));
      mockListStagedCatalog
        .mockResolvedValueOnce({ items: fullPage, total: 105, page: 1, pageSize: 100 })
        .mockResolvedValueOnce({ items: shortPage, total: 105, page: 2, pageSize: 100 });
      mockPromote.mockResolvedValue({ products: [], variants: [], createdAny: true });

      await cjProviderDescriptor.runPipeline(1);

      expect(mockListStagedCatalog).toHaveBeenCalledTimes(2);
      expect(mockListStagedCatalog).toHaveBeenNthCalledWith(1, 1, {
        page: 1,
        pageSize: 100,
        syncStatus: 'Synced',
        promotionState: 'NotPromoted',
      });
      expect(mockListStagedCatalog).toHaveBeenNthCalledWith(2, 1, {
        page: 2,
        pageSize: 100,
        syncStatus: 'Synced',
        promotionState: 'NotPromoted',
      });
      expect(mockPromote).toHaveBeenCalledTimes(1);
      const promoteArgs = mockPromote.mock.calls[0][1];
      expect(promoteArgs.items).toHaveLength(105);
      expect(promoteArgs.activate).toBe(false);
      // Regression guard (cj-category-mapping): the pipeline no longer forces
      // a fixed categoryId on every auto-promoted item — promote() resolves
      // each item's real CJ category itself now, falling back to
      // CJ_DEFAULT_CATEGORY_ID only when that fails.
      expect(promoteArgs).not.toHaveProperty('categoryId');
    });

    it('should_report_NO_PROMOTABLE_ITEMS_and_not_call_promote_when_nothing_is_returned', async () => {
      mockVerifyConnection.mockResolvedValue({ healthy: true });
      mockSyncCatalog.mockResolvedValue({ itemsUpserted: 0, itemsFailed: 0, syncedAt: new Date() });
      mockListStagedCatalog.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });

      const result = await cjProviderDescriptor.runPipeline(1);

      expect(mockPromote).not.toHaveBeenCalled();
      expect(result.promotionSkippedReason).toBe('NO_PROMOTABLE_ITEMS');
    });

    it('should_catch_CjPromotionCategoryRequiredError_and_report_DEFAULT_CATEGORY_MISSING', async () => {
      mockVerifyConnection.mockResolvedValue({ healthy: true });
      mockSyncCatalog.mockResolvedValue({ itemsUpserted: 1, itemsFailed: 0, syncedAt: new Date() });
      mockListStagedCatalog.mockResolvedValue({
        items: [{ item: { id: 1 }, promotionState: 'NotPromoted', productId: null, productVariantId: null }],
        total: 1,
        page: 1,
        pageSize: 100,
      });
      mockPromote.mockRejectedValue(new CjPromotionCategoryRequiredError());

      const result = await cjProviderDescriptor.runPipeline(1);

      expect(result.promotionSkippedReason).toBe('DEFAULT_CATEGORY_MISSING');
      expect(result.itemsUpserted).toBe(1);
    });

    it('should_catch_CjPromotionValidationError_and_report_PRICE_RESOLUTION_FAILED', async () => {
      mockVerifyConnection.mockResolvedValue({ healthy: true });
      mockSyncCatalog.mockResolvedValue({ itemsUpserted: 1, itemsFailed: 0, syncedAt: new Date() });
      mockListStagedCatalog.mockResolvedValue({
        items: [{ item: { id: 1 }, promotionState: 'NotPromoted', productId: null, productVariantId: null }],
        total: 1,
        page: 1,
        pageSize: 100,
      });
      mockPromote.mockRejectedValue(new CjPromotionValidationError([]));

      const result = await cjProviderDescriptor.runPipeline(1);

      expect(result.promotionSkippedReason).toBe('PRICE_RESOLUTION_FAILED');
    });

    it('should_retry_excluding_items_that_failed_validation_and_still_promote_the_rest', async () => {
      // One poison item (e.g. a zero-cost item with no resolvable price) must
      // not block the entire remaining batch forever — promote() fails the
      // whole batch on any single bad item, so the descriptor must retry once
      // excluding exactly what the error reports.
      mockVerifyConnection.mockResolvedValue({ healthy: true });
      mockSyncCatalog.mockResolvedValue({ itemsUpserted: 3, itemsFailed: 0, syncedAt: new Date() });
      mockListStagedCatalog.mockResolvedValue({
        items: [
          { item: { id: 1 }, promotionState: 'NotPromoted', productId: null, productVariantId: null },
          { item: { id: 2 }, promotionState: 'NotPromoted', productId: null, productVariantId: null },
          { item: { id: 3 }, promotionState: 'NotPromoted', productId: null, productVariantId: null },
        ],
        total: 3,
        page: 1,
        pageSize: 100,
      });
      mockPromote
        .mockRejectedValueOnce(
          new CjPromotionValidationError([{ cjCatalogItemId: 2, code: 'CJ_PROMOTION_PRICE_REQUIRED', message: 'no price' }])
        )
        .mockResolvedValueOnce({ products: [], variants: [], createdAny: true });

      const result = await cjProviderDescriptor.runPipeline(1);

      expect(mockPromote).toHaveBeenCalledTimes(2);
      const retryItems = mockPromote.mock.calls[1][1].items.map((i: { cjCatalogItemId: number }) => i.cjCatalogItemId);
      expect(retryItems.sort()).toEqual([1, 3]);
      expect(result.promotionSkippedReason).toBeUndefined();
    });

    it('should_retry_excluding_items_that_failed_category_resolution_and_still_promote_the_rest', async () => {
      // Regression (adversarial-review Blocker finding): a poison item with
      // no resolvable CJ category and no CJ_DEFAULT_CATEGORY_ID fallback used
      // to abort the ENTIRE batch with no way to identify or exclude just the
      // offender — silently stalling auto-provisioning for a supplier
      // forever, contradicting this change's own spec requirement that other
      // resolvable items in the same run still get promoted.
      mockVerifyConnection.mockResolvedValue({ healthy: true });
      mockSyncCatalog.mockResolvedValue({ itemsUpserted: 3, itemsFailed: 0, syncedAt: new Date() });
      mockListStagedCatalog.mockResolvedValue({
        items: [
          { item: { id: 1 }, promotionState: 'NotPromoted', productId: null, productVariantId: null },
          { item: { id: 2 }, promotionState: 'NotPromoted', productId: null, productVariantId: null },
          { item: { id: 3 }, promotionState: 'NotPromoted', productId: null, productVariantId: null },
        ],
        total: 3,
        page: 1,
        pageSize: 100,
      });
      mockPromote
        .mockRejectedValueOnce(
          new CjPromotionCategoryRequiredError(undefined, [
            { cjCatalogItemId: 2, code: 'CJ_PROMOTION_CATEGORY_REQUIRED', message: 'no category' },
          ])
        )
        .mockResolvedValueOnce({ products: [], variants: [], createdAny: true });

      const result = await cjProviderDescriptor.runPipeline(1);

      expect(mockPromote).toHaveBeenCalledTimes(2);
      const retryItems = mockPromote.mock.calls[1][1].items.map((i: { cjCatalogItemId: number }) => i.cjCatalogItemId);
      expect(retryItems.sort()).toEqual([1, 3]);
      expect(result.promotionSkippedReason).toBeUndefined();
    });

    it('should_give_up_without_an_infinite_retry_when_every_item_fails_category_resolution', async () => {
      mockVerifyConnection.mockResolvedValue({ healthy: true });
      mockSyncCatalog.mockResolvedValue({ itemsUpserted: 1, itemsFailed: 0, syncedAt: new Date() });
      mockListStagedCatalog.mockResolvedValue({
        items: [{ item: { id: 1 }, promotionState: 'NotPromoted', productId: null, productVariantId: null }],
        total: 1,
        page: 1,
        pageSize: 100,
      });
      mockPromote.mockRejectedValue(
        new CjPromotionCategoryRequiredError(undefined, [
          { cjCatalogItemId: 1, code: 'CJ_PROMOTION_CATEGORY_REQUIRED', message: 'no category' },
        ])
      );

      const result = await cjProviderDescriptor.runPipeline(1);

      expect(mockPromote).toHaveBeenCalledTimes(1); // no retry — excluding the only item leaves nothing to promote
      expect(result.promotionSkippedReason).toBe('DEFAULT_CATEGORY_MISSING');
    });

    it('should_give_up_without_an_infinite_retry_when_every_item_fails_validation', async () => {
      mockVerifyConnection.mockResolvedValue({ healthy: true });
      mockSyncCatalog.mockResolvedValue({ itemsUpserted: 1, itemsFailed: 0, syncedAt: new Date() });
      mockListStagedCatalog.mockResolvedValue({
        items: [{ item: { id: 1 }, promotionState: 'NotPromoted', productId: null, productVariantId: null }],
        total: 1,
        page: 1,
        pageSize: 100,
      });
      mockPromote.mockRejectedValue(
        new CjPromotionValidationError([{ cjCatalogItemId: 1, code: 'CJ_PROMOTION_PRICE_REQUIRED', message: 'no price' }])
      );

      const result = await cjProviderDescriptor.runPipeline(1);

      expect(mockPromote).toHaveBeenCalledTimes(1); // no retry — excluding the only item leaves nothing to promote
      expect(result.promotionSkippedReason).toBe('PRICE_RESOLUTION_FAILED');
    });

    it('should_dedupe_ids_collected_across_pages', async () => {
      const fullPageWithOverlap = Array.from({ length: 100 }, (_, i) => ({
        item: { id: i + 1 },
        promotionState: 'NotPromoted',
        productId: null,
        productVariantId: null,
      }));
      // Second page repeats the last id of the first page (e.g. a row shifted
      // by a concurrent insert) plus 4 genuinely new ids.
      const secondPage = [
        { item: { id: 100 }, promotionState: 'NotPromoted', productId: null, productVariantId: null },
        ...Array.from({ length: 4 }, (_, i) => ({
          item: { id: 101 + i },
          promotionState: 'NotPromoted',
          productId: null,
          productVariantId: null,
        })),
      ];
      mockVerifyConnection.mockResolvedValue({ healthy: true });
      mockSyncCatalog.mockResolvedValue({ itemsUpserted: 104, itemsFailed: 0, syncedAt: new Date() });
      mockListStagedCatalog
        .mockResolvedValueOnce({ items: fullPageWithOverlap, total: 104, page: 1, pageSize: 100 })
        .mockResolvedValueOnce({ items: secondPage, total: 104, page: 2, pageSize: 100 });
      mockPromote.mockResolvedValue({ products: [], variants: [], createdAny: true });

      await cjProviderDescriptor.runPipeline(1);

      const promotedIds = mockPromote.mock.calls[0][1].items.map((i: { cjCatalogItemId: number }) => i.cjCatalogItemId);
      expect(promotedIds).toHaveLength(104); // 100 + 4 new, id 100 not duplicated
      expect(new Set(promotedIds).size).toBe(104);
    });

    it('should_rethrow_unexpected_errors_from_promote', async () => {
      mockVerifyConnection.mockResolvedValue({ healthy: true });
      mockSyncCatalog.mockResolvedValue({ itemsUpserted: 1, itemsFailed: 0, syncedAt: new Date() });
      mockListStagedCatalog.mockResolvedValue({
        items: [{ item: { id: 1 }, promotionState: 'NotPromoted', productId: null, productVariantId: null }],
        total: 1,
        page: 1,
        pageSize: 100,
      });
      mockPromote.mockRejectedValue(new Error('boom'));

      await expect(cjProviderDescriptor.runPipeline(1)).rejects.toThrow('boom');
    });

    it('should_report_variantsCreated_and_alreadyPromoted_split_from_promote_result', async () => {
      mockVerifyConnection.mockResolvedValue({ healthy: true });
      mockSyncCatalog.mockResolvedValue({ itemsUpserted: 2, itemsFailed: 0, syncedAt: new Date() });
      mockListStagedCatalog.mockResolvedValue({
        items: [
          { item: { id: 1 }, promotionState: 'NotPromoted', productId: null, productVariantId: null },
          { item: { id: 2 }, promotionState: 'NotPromoted', productId: null, productVariantId: null },
        ],
        total: 2,
        page: 1,
        pageSize: 100,
      });
      mockPromote.mockResolvedValue({
        products: [],
        variants: [
          { cjCatalogItemId: 1, productId: 1, productVariantId: 1, sku: 'a', wasAlreadyPromoted: false },
          { cjCatalogItemId: 2, productId: 1, productVariantId: 2, sku: 'b', wasAlreadyPromoted: true },
        ],
        createdAny: true,
      });

      const result = await cjProviderDescriptor.runPipeline(1);

      expect(result.variantsCreated).toBe(1);
      expect(result.alreadyPromoted).toBe(1);
    });
  });
});
