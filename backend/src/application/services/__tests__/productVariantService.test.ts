import { ProductVariantService } from '../productVariantService';
import { IProductVariantRepository, IProductRepository } from '../../../domain/repositories/productRepository';
import { IAutomationSettingsRepository } from '../../../domain/repositories/automationSettingsRepository';
import { ICjCatalogItemRepository } from '../../../domain/repositories/cjCatalogItemRepository';
import { ICjClient } from '../../../infrastructure/external/cjTypes';
import { Product } from '../../../domain/models/product';
import { ProductVariant } from '../../../domain/models/productVariant';
import { CjCatalogItem } from '../../../domain/models/cjCatalogItem';
import { ValidationError, CjItemNotMappedError, CjApiUnavailableError } from '../../validator';
import { ProductNotFoundError } from '../../../infrastructure/repositories/productRepository';
import {
  VariantNotFoundError,
  VariantComparePriceInvalidError,
} from '../../../infrastructure/repositories/productVariantRepository';

const makeProduct = () =>
  new Product({ id: 1, name: 'Summer Dress', slug: 'summer-dress', status: 'Active' });

const makeVariant = (overrides: Partial<ConstructorParameters<typeof ProductVariant>[0]> = {}) =>
  new ProductVariant({ id: 1, productId: 1, sku: 'SKU-001', publicPrice: 29.99, stockPolicy: 'SupplierManaged', ...overrides });

const makeAdminVariant = (overrides: Partial<ConstructorParameters<typeof ProductVariant>[0]> = {}) =>
  new ProductVariant({
    id: 1,
    productId: 1,
    sku: 'SKU-001',
    publicPrice: 29.99,
    stockPolicy: 'SupplierManaged',
    supplierCost: '10.00',
    shippingCostEstimate: null,
    ...overrides,
  });

const makeCatalogItem = (overrides: Partial<ConstructorParameters<typeof CjCatalogItem>[0]> = {}) =>
  new CjCatalogItem({
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

const mockVariantRepo: jest.Mocked<IProductVariantRepository> = {
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
};

const mockProductRepo: jest.Mocked<IProductRepository> = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const mockSettingsRepo: jest.Mocked<IAutomationSettingsRepository> = {
  get: jest.fn(),
  update: jest.fn(),
};

const mockCatalogRepo: jest.Mocked<ICjCatalogItemRepository> = {
  upsertMany: jest.fn(),
  reconcilePromotedVariantStock: jest.fn(),
  findBySupplierIntegrationId: jest.fn(),
  findByExternalRef: jest.fn(),
  findById: jest.fn(),
  findManyByIds: jest.fn(),
};

const mockCjClient: jest.Mocked<ICjClient> = {
  verifyConnection: jest.fn(),
  fetchCategories: jest.fn(),
  fetchCatalog: jest.fn(),
  fetchVariants: jest.fn(),
  calculateFreight: jest.fn(),
  createOrder: jest.fn(),
  getOrderDetail: jest.fn(),
};

const service = new ProductVariantService(
  mockVariantRepo,
  mockProductRepo,
  mockSettingsRepo,
  mockCatalogRepo,
  mockCjClient
);

const DEFAULT_SETTINGS = { id: 1, targetMargin: 5, defaultFreightDestinationCountry: 'ES', carrierAllowList: [] };

describe('ProductVariantService - create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create variant when product exists and data is valid', async () => {
    const v = makeVariant();
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findBySku.mockResolvedValue(null);
    mockVariantRepo.create.mockResolvedValue(v);
    const result = await service.create({ productId: 1, sku: 'SKU-001', publicPrice: 29.99, stockPolicy: 'SupplierManaged' });
    expect(result.sku).toBe('SKU-001');
  });

  it('should throw ProductNotFoundError when product does not exist', async () => {
    mockProductRepo.findById.mockResolvedValue(null);
    await expect(service.create({ productId: 99, sku: 'SKU-001', publicPrice: 29.99, stockPolicy: 'SupplierManaged' }))
      .rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('should throw ValidationError when sku is missing', async () => {
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    await expect(service.create({ productId: 1, sku: '', publicPrice: 29.99, stockPolicy: 'SupplierManaged' }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it('should throw ValidationError when publicPrice is missing', async () => {
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    await expect(service.create({ productId: 1, sku: 'SKU-001', publicPrice: 0, stockPolicy: 'SupplierManaged' }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it('should throw VariantComparePriceInvalidError when compareAtPrice <= publicPrice', async () => {
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    await expect(
      service.create({ productId: 1, sku: 'SKU-001', publicPrice: 29.99, compareAtPrice: 29.99, stockPolicy: 'SupplierManaged' })
    ).rejects.toBeInstanceOf(VariantComparePriceInvalidError);
  });

  it('should accept compareAtPrice > publicPrice', async () => {
    const v = makeVariant({ compareAtPrice: 49.99 });
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.create.mockResolvedValue(v);
    const result = await service.create({ productId: 1, sku: 'SKU-001', publicPrice: 29.99, compareAtPrice: 49.99, stockPolicy: 'SupplierManaged' });
    expect(result.compareAtPrice).toBe(49.99);
  });
});

describe('ProductVariantService - findById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsRepo.get.mockResolvedValue(DEFAULT_SETTINGS);
  });

  it('should return variant belonging to product', async () => {
    const v = makeVariant();
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findById.mockResolvedValue(v);
    const result = await service.findById(1, 1);
    expect(result.id).toEqual(v.id);
  });

  it('should throw VariantNotFoundError when variant belongs to different product', async () => {
    const v = makeVariant({ productId: 99 });
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findById.mockResolvedValue(v);
    await expect(service.findById(1, 1)).rejects.toBeInstanceOf(VariantNotFoundError);
  });

  it('should attach marginWarning=true when netMargin is below targetMargin', async () => {
    const v = makeAdminVariant({ publicPrice: 12, supplierCost: '10.00', shippingCostEstimate: 1 }); // netMargin = 1, target = 5
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findById.mockResolvedValue(v);
    const result = await service.findById(1, 1);
    expect(result.marginWarning).toBe(true);
  });

  it('should attach marginWarning=true when netMargin is negative', async () => {
    const v = makeAdminVariant({ publicPrice: 5, supplierCost: '10.00', shippingCostEstimate: 1 }); // netMargin = -6
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findById.mockResolvedValue(v);
    const result = await service.findById(1, 1);
    expect(result.marginWarning).toBe(true);
  });

  it('should attach marginWarning=false when netMargin meets targetMargin', async () => {
    const v = makeAdminVariant({ publicPrice: 20, supplierCost: '10.00', shippingCostEstimate: 1 }); // netMargin = 9
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findById.mockResolvedValue(v);
    const result = await service.findById(1, 1);
    expect(result.marginWarning).toBe(false);
  });
});

describe('ProductVariantService - update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should throw ValidationError when publicPrice is zero on update', async () => {
    const v = makeVariant();
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findById.mockResolvedValue(v);
    await expect(service.update(1, 1, { publicPrice: 0 }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it('should throw ValidationError when publicPrice is negative on update', async () => {
    const v = makeVariant();
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findById.mockResolvedValue(v);
    await expect(service.update(1, 1, { publicPrice: -5 }))
      .rejects.toBeInstanceOf(ValidationError);
  });
});

describe('ProductVariantService - softDelete', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should soft-delete variant when found and owned by product', async () => {
    const v = makeVariant();
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findById.mockResolvedValue(v);
    mockVariantRepo.softDelete.mockResolvedValue(v);
    await service.softDelete(1, 1);
    expect(mockVariantRepo.softDelete).toHaveBeenCalledWith(1);
  });
});

describe('ProductVariantService - refreshFreightEstimate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsRepo.get.mockResolvedValue(DEFAULT_SETTINGS);
  });

  it('should persist the lowest freight option as shippingCostEstimate', async () => {
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findById.mockResolvedValue(makeVariant());
    mockVariantRepo.findCjCatalogItemId.mockResolvedValue(42);
    mockCatalogRepo.findById.mockResolvedValue(makeCatalogItem());
    mockCjClient.calculateFreight.mockResolvedValue([
      { logisticName: 'Expensive', logisticAging: '3-5', logisticPrice: 9.5, totalPostageFee: 9.5 },
      { logisticName: 'Cheap', logisticAging: '7-10', logisticPrice: 3.2, totalPostageFee: 3.2 },
    ]);
    mockVariantRepo.updateShippingCostEstimate.mockResolvedValue(
      makeAdminVariant({ shippingCostEstimate: 3.2 })
    );

    const result = await service.refreshFreightEstimate(1, 1);

    expect(mockVariantRepo.updateShippingCostEstimate).toHaveBeenCalledWith(1, 3.2);
    expect(result.shippingCostEstimate).toBe(3.2);
  });

  it('should use the requested destinationCountry over the configured default', async () => {
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findById.mockResolvedValue(makeVariant());
    mockVariantRepo.findCjCatalogItemId.mockResolvedValue(42);
    mockCatalogRepo.findById.mockResolvedValue(makeCatalogItem());
    mockCjClient.calculateFreight.mockResolvedValue([
      { logisticName: 'Only', logisticAging: '3-5', logisticPrice: 4, totalPostageFee: 4 },
    ]);
    mockVariantRepo.updateShippingCostEstimate.mockResolvedValue(makeAdminVariant());

    await service.refreshFreightEstimate(1, 1, 'FR');

    expect(mockCjClient.calculateFreight).toHaveBeenCalledWith(
      expect.objectContaining({ endCountryCode: 'FR' })
    );
  });

  it('should throw CjItemNotMappedError when the variant has no linked CjCatalogItem', async () => {
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findById.mockResolvedValue(makeVariant());
    mockVariantRepo.findCjCatalogItemId.mockResolvedValue(null);

    await expect(service.refreshFreightEstimate(1, 1)).rejects.toBeInstanceOf(CjItemNotMappedError);
    expect(mockCjClient.calculateFreight).not.toHaveBeenCalled();
  });

  it('should throw CjApiUnavailableError when the freight quote call fails', async () => {
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findById.mockResolvedValue(makeVariant());
    mockVariantRepo.findCjCatalogItemId.mockResolvedValue(42);
    mockCatalogRepo.findById.mockResolvedValue(makeCatalogItem());
    mockCjClient.calculateFreight.mockRejectedValue(new Error('network error'));

    await expect(service.refreshFreightEstimate(1, 1)).rejects.toBeInstanceOf(CjApiUnavailableError);
  });

  it('should throw CjApiUnavailableError when the quote returns no options', async () => {
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findById.mockResolvedValue(makeVariant());
    mockVariantRepo.findCjCatalogItemId.mockResolvedValue(42);
    mockCatalogRepo.findById.mockResolvedValue(makeCatalogItem());
    mockCjClient.calculateFreight.mockResolvedValue([]);

    await expect(service.refreshFreightEstimate(1, 1)).rejects.toBeInstanceOf(CjApiUnavailableError);
  });
});
