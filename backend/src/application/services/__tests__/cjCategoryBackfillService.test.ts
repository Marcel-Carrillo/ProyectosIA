import { CjCategoryBackfillService } from '../cjCategoryBackfillService';
import { CjCatalogItem } from '../../../domain/models/cjCatalogItem';
import { IProductRepository, IProductVariantRepository } from '../../../domain/repositories/productRepository';
import { ICategoryRepository } from '../../../domain/repositories';
import { ICjCatalogItemRepository } from '../../../domain/repositories/cjCatalogItemRepository';
import { ISupplierIntegrationRepository } from '../../../domain/repositories/supplierIntegrationRepository';
import { ICjClient } from '../../../infrastructure/external/cjTypes';
import { Category } from '../../../domain/models';
import { SupplierIntegration } from '../../../domain/models/supplierIntegration';
import { SupplierIntegrationNotFoundError } from '../../../infrastructure/repositories/supplierIntegrationRepository';
import { CjPromotionCategoryRequiredError } from '../../validator';

function buildCatalogItem(overrides: Partial<ConstructorParameters<typeof CjCatalogItem>[0]> = {}): CjCatalogItem {
  return new CjCatalogItem({
    id: 1,
    supplierIntegrationId: 7,
    externalRef: 'vid-1',
    title: 'Test Dress',
    supplierCost: '10.00',
    stockQuantity: 5,
    rawPayload: {},
    syncStatus: 'Synced',
    ...overrides,
  });
}

describe('CjCategoryBackfillService', () => {
  let productRepo: jest.Mocked<IProductRepository>;
  let variantRepo: jest.Mocked<IProductVariantRepository>;
  let categoryRepo: jest.Mocked<ICategoryRepository>;
  let catalogRepo: jest.Mocked<ICjCatalogItemRepository>;
  let integrationRepo: jest.Mocked<ISupplierIntegrationRepository>;
  let cjClient: jest.Mocked<ICjClient>;
  let service: CjCategoryBackfillService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['CJ_DEFAULT_CATEGORY_ID'] = '1';

    productRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      reassignCategoryIfCurrentlyCategory: jest.fn(),
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
    categoryRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findOrCreateByExternalRef: jest.fn(),
    };
    catalogRepo = {
      upsertMany: jest.fn(),
      reconcilePromotedVariantStock: jest.fn(),
      findBySupplierIntegrationId: jest.fn(),
      findByExternalRef: jest.fn(),
      findById: jest.fn(),
      findManyByIds: jest.fn(),
    };
    integrationRepo = {
      findBySupplierId: jest.fn(),
      upsert: jest.fn(),
      updateStatus: jest.fn(),
      updateLastSyncedAt: jest.fn(),
      updateCatalogSyncCursor: jest.fn(),
    };
    cjClient = {
      verifyConnection: jest.fn(),
      fetchCategories: jest.fn().mockResolvedValue([]),
      fetchCatalog: jest.fn(),
      fetchVariants: jest.fn(),
      calculateFreight: jest.fn(),
      createOrder: jest.fn(),
      getOrderDetail: jest.fn(),
      simulateSandboxAdvance: jest.fn(),
    };

    integrationRepo.findBySupplierId.mockResolvedValue(new SupplierIntegration({ id: 7, supplierId: 3 }));
    categoryRepo.findById.mockResolvedValue(new Category({ id: 1, name: 'Uncategorized', status: 'Active' }));

    service = new CjCategoryBackfillService(productRepo, variantRepo, categoryRepo, catalogRepo, integrationRepo, cjClient);
  });

  it('should_throw_supplier_integration_not_found_when_supplier_has_no_cj_connection', async () => {
    integrationRepo.findBySupplierId.mockResolvedValue(null);
    await expect(service.recategorize(10)).rejects.toBeInstanceOf(SupplierIntegrationNotFoundError);
  });

  it('should_throw_category_required_when_no_fallback_category_is_configured', async () => {
    delete process.env['CJ_DEFAULT_CATEGORY_ID'];
    await expect(service.recategorize(10)).rejects.toBeInstanceOf(CjPromotionCategoryRequiredError);
    expect(variantRepo.findManyByProductCategoryId).not.toHaveBeenCalled();
  });

  it('should_reassign_an_eligible_product_with_a_single_resolvable_cj_category', async () => {
    variantRepo.findManyByProductCategoryId.mockResolvedValue([
      { productId: 100, variantId: 1, cjCatalogItemId: 1 },
      { productId: 100, variantId: 2, cjCatalogItemId: 2 },
    ]);
    catalogRepo.findManyByIds.mockResolvedValue([
      buildCatalogItem({ id: 1, categoryId: 'CJ-EXT-1' }),
      buildCatalogItem({ id: 2, categoryId: 'CJ-EXT-1' }),
    ]);
    cjClient.fetchCategories.mockResolvedValue([
      { categoryFirstName: 'Fashion', categoryFirstList: [{ categorySecondName: 'Dresses', categorySecondList: [{ categoryId: 'CJ-EXT-1', categoryName: 'Dresses' }] }] },
    ]);
    categoryRepo.findOrCreateByExternalRef.mockResolvedValue(new Category({ id: 42, name: 'Dresses', status: 'Inactive' }));
    productRepo.reassignCategoryIfCurrentlyCategory.mockResolvedValue(true);

    const result = await service.recategorize(10);

    expect(categoryRepo.findOrCreateByExternalRef).toHaveBeenCalledWith('CJDropshipping', 'CJ-EXT-1', 'Dresses');
    expect(productRepo.reassignCategoryIfCurrentlyCategory).toHaveBeenCalledWith(100, 1, 42);
    expect(result).toEqual({ fromCategoryId: 1, reassigned: [{ productId: 100, toCategoryId: 42 }], skipped: [] });
  });

  it('should_skip_a_product_with_no_cj_mapped_variants', async () => {
    variantRepo.findManyByProductCategoryId.mockResolvedValue([{ productId: 100, variantId: 1, cjCatalogItemId: null }]);
    catalogRepo.findManyByIds.mockResolvedValue([]);

    const result = await service.recategorize(10);

    expect(result.skipped).toEqual([{ productId: 100, reason: 'NO_CJ_CATEGORY_MAPPING' }]);
    expect(result.reassigned).toEqual([]);
    expect(categoryRepo.findOrCreateByExternalRef).not.toHaveBeenCalled();
  });

  it('should_skip_a_product_whose_variants_disagree_on_cj_category', async () => {
    variantRepo.findManyByProductCategoryId.mockResolvedValue([
      { productId: 100, variantId: 1, cjCatalogItemId: 1 },
      { productId: 100, variantId: 2, cjCatalogItemId: 2 },
    ]);
    catalogRepo.findManyByIds.mockResolvedValue([
      buildCatalogItem({ id: 1, categoryId: 'CJ-EXT-1' }),
      buildCatalogItem({ id: 2, categoryId: 'CJ-EXT-2' }),
    ]);

    const result = await service.recategorize(10);

    expect(result.skipped).toEqual([{ productId: 100, reason: 'CONFLICTING_CJ_CATEGORIES' }]);
    expect(productRepo.reassignCategoryIfCurrentlyCategory).not.toHaveBeenCalled();
  });

  it('should_skip_a_product_when_cj_category_resolution_fails', async () => {
    variantRepo.findManyByProductCategoryId.mockResolvedValue([{ productId: 100, variantId: 1, cjCatalogItemId: 1 }]);
    catalogRepo.findManyByIds.mockResolvedValue([buildCatalogItem({ id: 1, categoryId: 'CJ-EXT-1' })]);
    cjClient.fetchCategories.mockResolvedValue([]); // tree has no entry for CJ-EXT-1

    const result = await service.recategorize(10);

    expect(result.skipped).toEqual([{ productId: 100, reason: 'CJ_CATEGORY_RESOLUTION_FAILED' }]);
    expect(categoryRepo.findOrCreateByExternalRef).not.toHaveBeenCalled();
  });

  it('should_report_category_changed_concurrently_when_the_conditional_write_no_ops', async () => {
    variantRepo.findManyByProductCategoryId.mockResolvedValue([{ productId: 100, variantId: 1, cjCatalogItemId: 1 }]);
    catalogRepo.findManyByIds.mockResolvedValue([buildCatalogItem({ id: 1, categoryId: 'CJ-EXT-1' })]);
    cjClient.fetchCategories.mockResolvedValue([
      { categoryFirstName: 'Fashion', categoryFirstList: [{ categorySecondName: 'Dresses', categorySecondList: [{ categoryId: 'CJ-EXT-1', categoryName: 'Dresses' }] }] },
    ]);
    categoryRepo.findOrCreateByExternalRef.mockResolvedValue(new Category({ id: 42, name: 'Dresses', status: 'Inactive' }));
    productRepo.reassignCategoryIfCurrentlyCategory.mockResolvedValue(false);

    const result = await service.recategorize(10);

    expect(result.skipped).toEqual([{ productId: 100, reason: 'CATEGORY_CHANGED_CONCURRENTLY' }]);
    expect(result.reassigned).toEqual([]);
  });

  it('should_only_count_cj_catalog_items_belonging_to_this_supplier_integration', async () => {
    // A CjCatalogItem with a matching id but a DIFFERENT supplierIntegrationId
    // must not count toward resolution (data isolation between suppliers).
    variantRepo.findManyByProductCategoryId.mockResolvedValue([{ productId: 100, variantId: 1, cjCatalogItemId: 1 }]);
    catalogRepo.findManyByIds.mockResolvedValue([buildCatalogItem({ id: 1, supplierIntegrationId: 999, categoryId: 'CJ-EXT-1' })]);

    const result = await service.recategorize(10);

    expect(result.skipped).toEqual([{ productId: 100, reason: 'NO_CJ_CATEGORY_MAPPING' }]);
  });

  it('should_be_a_no_op_on_a_second_run_since_reassigned_products_no_longer_match_fromCategoryId', async () => {
    // Idempotency falls out of the read filter: the query is scoped to
    // fromCategoryId, so a second call simply returns nothing once the repo
    // no longer reports the product at that category.
    variantRepo.findManyByProductCategoryId.mockResolvedValueOnce([]);

    const result = await service.recategorize(10);

    expect(result).toEqual({ fromCategoryId: 1, reassigned: [], skipped: [] });
  });
});
