import { ProductVariantService } from '../productVariantService';
import { IProductVariantRepository, IProductRepository } from '../../../domain/repositories/productRepository';
import { Product } from '../../../domain/models/product';
import { ProductVariant } from '../../../domain/models/productVariant';
import { ValidationError } from '../../validator';
import { ProductNotFoundError } from '../../../infrastructure/repositories/productRepository';
import {
  VariantNotFoundError,
  VariantComparePriceInvalidError,
} from '../../../infrastructure/repositories/productVariantRepository';

const makeProduct = () =>
  new Product({ id: 1, name: 'Summer Dress', slug: 'summer-dress', status: 'Active' });

const makeVariant = (overrides: Partial<ConstructorParameters<typeof ProductVariant>[0]> = {}) =>
  new ProductVariant({ id: 1, productId: 1, sku: 'SKU-001', publicPrice: 29.99, stockPolicy: 'SupplierManaged', ...overrides });

const mockVariantRepo: jest.Mocked<IProductVariantRepository> = {
  findByProduct: jest.fn(),
  findById: jest.fn(),
  findBySku: jest.fn(),
  countActiveByProduct: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const mockProductRepo: jest.Mocked<IProductRepository> = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const service = new ProductVariantService(mockVariantRepo, mockProductRepo);

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
  beforeEach(() => jest.clearAllMocks());

  it('should return variant belonging to product', async () => {
    const v = makeVariant();
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findById.mockResolvedValue(v);
    const result = await service.findById(1, 1);
    expect(result).toEqual(v);
  });

  it('should throw VariantNotFoundError when variant belongs to different product', async () => {
    const v = makeVariant({ productId: 99 });
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findById.mockResolvedValue(v);
    await expect(service.findById(1, 1)).rejects.toBeInstanceOf(VariantNotFoundError);
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
