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

  jest.mock('../../prismaClient', () => ({
    prisma: {
      productVariant: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        create: (...args: unknown[]) => mockCreate(...args),
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
});
