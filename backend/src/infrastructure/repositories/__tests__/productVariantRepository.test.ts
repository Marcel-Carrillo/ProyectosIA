import { ProductVariant } from '../../../domain/models/productVariant';

// Supplier sourcing fields live on the domain model for ADMIN reads (margin
// visibility in the backoffice). The customer-facing invariant is enforced at
// the serializer layer and covered by supplierIsolation.test.ts.
describe('ProductVariant domain model - supplier fields', () => {
  it('defaults supplier fields to null when not selected (customer-safe selects)', () => {
    const variant = new ProductVariant({
      id: 1,
      productId: 1,
      sku: 'SKU-001',
      publicPrice: 29.99,
      stockPolicy: 'SupplierManaged',
    });
    expect(variant.supplierId).toBeNull();
    expect(variant.supplierReference).toBeNull();
    expect(variant.supplierCost).toBeNull();
    expect(variant.supplierName).toBeNull();
  });

  it('maps supplier fields from an admin select row (cost as number, name from relation)', () => {
    const variant = new ProductVariant({
      id: 1,
      productId: 1,
      sku: 'SKU-001',
      publicPrice: 29.99,
      stockPolicy: 'SupplierManaged',
      supplierId: 7,
      supplierReference: 'SUP-REF-XYZ',
      supplierCost: '12.50',
      supplier: { name: 'CJ Dropshipping' },
    });
    expect(variant.supplierId).toBe(7);
    expect(variant.supplierReference).toBe('SUP-REF-XYZ');
    expect(variant.supplierCost).toBe(12.5);
    expect(variant.supplierName).toBe('CJ Dropshipping');
  });

  it('should correctly serialize publicPrice and compareAtPrice as numbers', () => {
    const variant = new ProductVariant({
      id: 1,
      productId: 1,
      sku: 'SKU-001',
      publicPrice: '29.99',
      compareAtPrice: '49.99',
      stockPolicy: 'SupplierManaged',
    });
    expect(typeof variant.publicPrice).toBe('number');
    expect(variant.publicPrice).toBe(29.99);
    expect(typeof variant.compareAtPrice).toBe('number');
    expect(variant.compareAtPrice).toBe(49.99);
  });
});

describe('variantSelect - supplier fields absent from selectable fields', () => {
  it('variantSelect constant in productVariantRepository must not include supplier fields', async () => {
    const repoModule = await import('../productVariantRepository');
    const repo = new repoModule.ProductVariantRepository();

    const fieldNames = Object.getOwnPropertyNames(repo);
    expect(fieldNames).not.toContain('supplierId');
    expect(fieldNames).not.toContain('supplierReference');
    expect(fieldNames).not.toContain('supplierCost');
  });
});

describe('ProductVariantRepository - findByCjCatalogItemId / create with cjCatalogItemId link', () => {
  const mockFindFirst = jest.fn();
  const mockCreate = jest.fn();
  const mockUpdate = jest.fn();
  const mockProductFindMany = jest.fn();
  const mockVariantFindMany = jest.fn();

  jest.mock('../../prismaClient', () => ({
    prisma: {
      productVariant: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        create: (...args: unknown[]) => mockCreate(...args),
        update: (...args: unknown[]) => mockUpdate(...args),
        findMany: (...args: unknown[]) => mockVariantFindMany(...args),
      },
      product: {
        findMany: (...args: unknown[]) => mockProductFindMany(...args),
      },
    },
  }));

  const dbRow = {
    id: 1,
    productId: 10,
    sku: 'CJ-vid-1',
    size: null,
    color: null,
    publicPrice: { toString: () => '29.99' },
    compareAtPrice: null,
    stockPolicy: 'SupplierManaged',
    status: 'Active',
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should_return_variant_when_findByCjCatalogItemId_finds_a_match', async () => {
    mockFindFirst.mockResolvedValue(dbRow);
    const repoModule = await import('../productVariantRepository');
    const repo = new repoModule.ProductVariantRepository();

    const result = await repo.findByCjCatalogItemId(42);

    expect(result?.id).toBe(1);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { cjCatalogItemId: 42, deletedAt: null },
      select: expect.not.objectContaining({ cjCatalogItemId: true }),
    });
  });

  it('should_return_null_when_findByCjCatalogItemId_finds_no_match', async () => {
    mockFindFirst.mockResolvedValue(null);
    const repoModule = await import('../productVariantRepository');
    const repo = new repoModule.ProductVariantRepository();

    const result = await repo.findByCjCatalogItemId(999);

    expect(result).toBeNull();
  });

  it('should_persist_cjCatalogItemId_when_creating_a_variant_with_a_link', async () => {
    mockFindFirst.mockResolvedValue(null); // findBySku pre-check inside create()
    mockCreate.mockResolvedValue(dbRow);
    const repoModule = await import('../productVariantRepository');
    const repo = new repoModule.ProductVariantRepository();

    await repo.create({
      productId: 10,
      sku: 'CJ-vid-1',
      publicPrice: 29.99,
      stockPolicy: 'SupplierManaged',
      cjCatalogItemId: 42,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cjCatalogItemId: 42 }) })
    );
  });

  it('should_default_cjCatalogItemId_to_null_when_not_provided_on_create', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue(dbRow);
    const repoModule = await import('../productVariantRepository');
    const repo = new repoModule.ProductVariantRepository();

    await repo.create({
      productId: 10,
      sku: 'SKU-002',
      publicPrice: 29.99,
      stockPolicy: 'SupplierManaged',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cjCatalogItemId: null }) })
    );
  });

  it('should_ignore_a_client_supplied_stockQuantity_on_update_read_only_guarantee', async () => {
    mockFindFirst.mockResolvedValue(dbRow); // findById() pre-check inside update()
    mockUpdate.mockResolvedValue(dbRow);
    const repoModule = await import('../productVariantRepository');
    const repo = new repoModule.ProductVariantRepository();

    await repo.update(1, {
      publicPrice: 39.99,
      // stockQuantity is intentionally not part of ProductVariantUpdateData —
      // cast to bypass the type system the same way an Express controller
      // casting req.body would, to prove the field has no write path.
      ...({ stockQuantity: 999 } as unknown as Record<string, never>),
    });

    const call = mockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data).not.toHaveProperty('stockQuantity');
  });

  it('should_return_the_linked_cjCatalogItemId_via_a_narrow_select', async () => {
    mockFindFirst.mockResolvedValue({ cjCatalogItemId: 42 });
    const repoModule = await import('../productVariantRepository');
    const repo = new repoModule.ProductVariantRepository();

    const result = await repo.findCjCatalogItemId(1);

    expect(result).toBe(42);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: 1, deletedAt: null },
      select: { cjCatalogItemId: true },
    });
  });

  it('should_return_null_when_variant_has_no_linked_cjCatalogItemId', async () => {
    mockFindFirst.mockResolvedValue({ cjCatalogItemId: null });
    const repoModule = await import('../productVariantRepository');
    const repo = new repoModule.ProductVariantRepository();

    expect(await repo.findCjCatalogItemId(1)).toBeNull();
  });

  it('should_persist_shippingCostEstimate_via_updateShippingCostEstimate', async () => {
    mockUpdate.mockResolvedValue(dbRow);
    const repoModule = await import('../productVariantRepository');
    const repo = new repoModule.ProductVariantRepository();

    await repo.updateShippingCostEstimate(1, 4.5);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { shippingCostEstimate: 4.5 } })
    );
  });

  describe('findManyByProductCategoryId (bounded backfill query)', () => {
    // Regression (production incident 2026-07-17): the original version had
    // no `take` at all and queried productVariant directly by category,
    // which loaded every matching row in one call — with thousands of
    // legacy products sharing one supplier's fallback category, that timed
    // out the app Lambda's 6s default timeout every time.
    it('should_cap_by_distinct_product_count_via_take_on_the_product_query', async () => {
      mockProductFindMany.mockResolvedValue([{ id: 100 }, { id: 101 }]);
      mockVariantFindMany.mockResolvedValue([
        { id: 1, productId: 100, cjCatalogItemId: 5 },
        { id: 2, productId: 101, cjCatalogItemId: 6 },
      ]);
      const repoModule = await import('../productVariantRepository');
      const repo = new repoModule.ProductVariantRepository();

      const result = await repo.findManyByProductCategoryId(48, 2);

      expect(mockProductFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { categoryId: 48, deletedAt: null }, take: 2 })
      );
      expect(mockVariantFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null, productId: { in: [100, 101] } } })
      );
      expect(result).toEqual([
        { productId: 100, variantId: 1, cjCatalogItemId: 5 },
        { productId: 101, variantId: 2, cjCatalogItemId: 6 },
      ]);
    });

    it('should_return_every_variant_for_a_capped_product_not_just_the_first', async () => {
      // The two-step query exists specifically so a product with multiple
      // variants doesn't get truncated mid-product by the limit — the limit
      // caps PRODUCT count, never variant rows.
      mockProductFindMany.mockResolvedValue([{ id: 100 }]);
      mockVariantFindMany.mockResolvedValue([
        { id: 1, productId: 100, cjCatalogItemId: 5 },
        { id: 2, productId: 100, cjCatalogItemId: 6 },
        { id: 3, productId: 100, cjCatalogItemId: 7 },
      ]);
      const repoModule = await import('../productVariantRepository');
      const repo = new repoModule.ProductVariantRepository();

      const result = await repo.findManyByProductCategoryId(48, 1);

      expect(result).toHaveLength(3);
    });

    it('should_skip_the_variant_query_entirely_when_no_products_match', async () => {
      mockProductFindMany.mockResolvedValue([]);
      const repoModule = await import('../productVariantRepository');
      const repo = new repoModule.ProductVariantRepository();

      const result = await repo.findManyByProductCategoryId(48, 25);

      expect(result).toEqual([]);
      expect(mockVariantFindMany).not.toHaveBeenCalled();
    });
  });
});
