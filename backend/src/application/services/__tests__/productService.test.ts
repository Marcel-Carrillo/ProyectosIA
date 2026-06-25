import { ProductService } from '../productService';
import { IProductRepository, IProductVariantRepository, ProductListResult } from '../../../domain/repositories/productRepository';
import { IProductTranslationRepository } from '../../../domain/repositories/productTranslationRepository';
import { Product } from '../../../domain/models/product';
import { ProductTranslation } from '../../../domain/models/productTranslation';
import { ValidationError, TranslationLocaleInvalidError } from '../../validator';
import {
  ProductNotFoundError,
  ProductSlugConflictError,
  ProductRequiresActiveVariantError,
  ProductArchivedCannotReactivateError,
} from '../../../infrastructure/repositories/productRepository';
import { TranslationNotFoundError } from '../../../infrastructure/repositories/productTranslationRepository';

const makeProduct = (overrides: Partial<ConstructorParameters<typeof Product>[0]> = {}) =>
  new Product({ id: 1, name: 'Summer Dress', slug: 'summer-dress', status: 'Draft', ...overrides });

const mockListResult = (items: Product[]): ProductListResult => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
});

const mockRepo: jest.Mocked<IProductRepository> = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const mockVariantRepo: jest.Mocked<IProductVariantRepository> = {
  findByProduct: jest.fn(),
  findById: jest.fn(),
  findBySku: jest.fn(),
  countActiveByProduct: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const mockTranslationRepo: jest.Mocked<IProductTranslationRepository> = {
  upsert: jest.fn(),
  findByProduct: jest.fn(),
  findByProductAndLocale: jest.fn(),
  delete: jest.fn(),
};

const service = new ProductService(mockRepo, mockVariantRepo, mockTranslationRepo);

describe('ProductService - findAll', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return paginated product list', async () => {
    const result = mockListResult([makeProduct()]);
    mockRepo.findAll.mockResolvedValue(result);
    const res = await service.findAll();
    expect(res.items).toHaveLength(1);
    expect(res.total).toBe(1);
  });
});

describe('ProductService - findById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return product when found', async () => {
    const p = makeProduct();
    mockRepo.findById.mockResolvedValue(p);
    const result = await service.findById(1);
    expect(result).toEqual(p);
  });

  it('should throw ProductNotFoundError when not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.findById(99)).rejects.toBeInstanceOf(ProductNotFoundError);
  });
});

describe('ProductService - create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create product with auto-generated slug', async () => {
    const p = makeProduct({ slug: 'summer-dress' });
    mockRepo.findBySlug.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(p);
    const result = await service.create({ name: 'Summer Dress' });
    expect(result.slug).toBe('summer-dress');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Summer Dress', slug: 'summer-dress' })
    );
  });

  it('should default status to Draft', async () => {
    const p = makeProduct({ status: 'Draft' });
    mockRepo.findBySlug.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(p);
    const result = await service.create({ name: 'Summer Dress' });
    expect(result.status).toBe('Draft');
  });

  it('should retry slug with numeric suffix on collision', async () => {
    const existing = makeProduct({ slug: 'summer-dress' });
    mockRepo.findBySlug
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(null);
    mockRepo.create.mockResolvedValue(makeProduct({ slug: 'summer-dress-2' }));
    const result = await service.create({ name: 'Summer Dress' });
    expect(result.slug).toBe('summer-dress-2');
  });

  it('should throw ProductSlugConflictError after all slug suffixes are taken', async () => {
    const existing = makeProduct();
    mockRepo.findBySlug.mockResolvedValue(existing);
    await expect(service.create({ name: 'Summer Dress' })).rejects.toBeInstanceOf(ProductSlugConflictError);
    expect(mockRepo.findBySlug).toHaveBeenCalledTimes(6);
  });

  it('should use base-6 slug when base through base-5 are taken', async () => {
    const existing = makeProduct();
    mockRepo.findBySlug
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(null);
    mockRepo.create.mockResolvedValue(makeProduct({ slug: 'summer-dress-6' }));
    const result = await service.create({ name: 'Summer Dress' });
    expect(result.slug).toBe('summer-dress-6');
  });

  it('should throw ProductRequiresActiveVariantError when creating with Active status', async () => {
    await expect(service.create({ name: 'Summer Dress', status: 'Active' }))
      .rejects.toBeInstanceOf(ProductRequiresActiveVariantError);
  });

  it('should throw ValidationError when name is missing', async () => {
    await expect(service.create({ name: '' } as Parameters<typeof service.create>[0])).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('ProductService - update lifecycle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should activate Draft product with active variants', async () => {
    const draft = makeProduct({ status: 'Draft' });
    const active = makeProduct({ status: 'Active' });
    mockRepo.findById.mockResolvedValueOnce(draft).mockResolvedValueOnce(active);
    mockVariantRepo.countActiveByProduct.mockResolvedValue(2);
    mockRepo.update.mockResolvedValue(active);
    const result = await service.update(1, { status: 'Active' });
    expect(result.status).toBe('Active');
  });

  it('should throw ProductRequiresActiveVariantError when activating with no active variants', async () => {
    const draft = makeProduct({ status: 'Draft' });
    mockRepo.findById.mockResolvedValue(draft);
    mockVariantRepo.countActiveByProduct.mockResolvedValue(0);
    await expect(service.update(1, { status: 'Active' })).rejects.toBeInstanceOf(ProductRequiresActiveVariantError);
  });

  it('should throw ProductArchivedCannotReactivateError when reactivating Archived product', async () => {
    const archived = makeProduct({ status: 'Archived' });
    mockRepo.findById.mockResolvedValue(archived);
    await expect(service.update(1, { status: 'Active' })).rejects.toBeInstanceOf(ProductArchivedCannotReactivateError);
  });

  it('should reject any status change on Archived product', async () => {
    const archived = makeProduct({ status: 'Archived' });
    mockRepo.findById.mockResolvedValue(archived);
    await expect(service.update(1, { status: 'Inactive' })).rejects.toBeInstanceOf(ProductArchivedCannotReactivateError);
  });

  it('should throw ProductNotFoundError when product does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.update(99, { name: 'X' })).rejects.toBeInstanceOf(ProductNotFoundError);
  });
});

describe('ProductService - softDelete', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should call repo.softDelete when product exists', async () => {
    const p = makeProduct();
    mockRepo.findById.mockResolvedValue(p);
    mockRepo.softDelete.mockResolvedValue(undefined);
    await service.softDelete(1);
    expect(mockRepo.softDelete).toHaveBeenCalledWith(1);
  });

  it('should throw ProductNotFoundError when product does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.softDelete(99)).rejects.toBeInstanceOf(ProductNotFoundError);
  });
});

const makeTranslation = (overrides: Partial<ConstructorParameters<typeof ProductTranslation>[0]> = {}) =>
  new ProductTranslation({ productId: 1, locale: 'es', name: 'Vestido', description: null, source: 'manual', ...overrides });

describe('ProductService - create with translations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upserts translations after product creation', async () => {
    const product = makeProduct();
    mockRepo.findBySlug.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(product);
    mockTranslationRepo.upsert.mockResolvedValue(makeTranslation());

    await service.create({ name: 'Summer Dress', translations: [{ locale: 'es', name: 'Vestido', source: 'manual' }] });

    expect(mockTranslationRepo.upsert).toHaveBeenCalledWith(1, 'es', expect.objectContaining({ name: 'Vestido' }));
  });

  it('skips translation upsert when translations array is empty', async () => {
    mockRepo.findBySlug.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(makeProduct());

    await service.create({ name: 'Summer Dress', translations: [] });

    expect(mockTranslationRepo.upsert).not.toHaveBeenCalled();
  });

  it('throws TranslationLocaleInvalidError for unsupported locale', async () => {
    mockRepo.findBySlug.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(makeProduct());

    await expect(
      service.create({ name: 'Summer Dress', translations: [{ locale: 'fr', name: 'Robe', source: 'manual' }] }),
    ).rejects.toBeInstanceOf(TranslationLocaleInvalidError);
  });
});

describe('ProductService - upsertTranslation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upserts a translation for an existing product', async () => {
    mockRepo.findById.mockResolvedValue(makeProduct());
    const translation = makeTranslation();
    mockTranslationRepo.upsert.mockResolvedValue(translation);

    const result = await service.upsertTranslation(1, 'es', { name: 'Vestido', source: 'manual' });

    expect(mockTranslationRepo.upsert).toHaveBeenCalledWith(1, 'es', expect.objectContaining({ name: 'Vestido' }));
    expect(result).toBe(translation);
  });

  it('throws ProductNotFoundError when product does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.upsertTranslation(99, 'es', { name: 'Vestido', source: 'manual' })).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('throws TranslationLocaleInvalidError for unsupported locale', async () => {
    mockRepo.findById.mockResolvedValue(makeProduct());
    await expect(service.upsertTranslation(1, 'fr', { name: 'Robe', source: 'manual' })).rejects.toBeInstanceOf(TranslationLocaleInvalidError);
  });
});

describe('ProductService - listTranslations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns all translations for an existing product', async () => {
    mockRepo.findById.mockResolvedValue(makeProduct());
    const translations = [makeTranslation(), makeTranslation({ locale: 'en', name: 'Summer Dress' })];
    mockTranslationRepo.findByProduct.mockResolvedValue(translations);

    const result = await service.listTranslations(1);

    expect(result).toBe(translations);
    expect(mockTranslationRepo.findByProduct).toHaveBeenCalledWith(1);
  });

  it('throws ProductNotFoundError when product does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.listTranslations(99)).rejects.toBeInstanceOf(ProductNotFoundError);
  });
});

describe('ProductService - update with translations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upserts translations and returns refreshed product', async () => {
    const product = makeProduct();
    const refreshed = makeProduct({ translations: [makeTranslation()] });
    mockRepo.findById.mockResolvedValueOnce(product).mockResolvedValueOnce(refreshed);
    mockRepo.update.mockResolvedValue(product);
    mockTranslationRepo.upsert.mockResolvedValue(makeTranslation());

    const result = await service.update(1, {
      name: 'Updated',
      translations: [{ locale: 'es', name: 'Actualizado', source: 'manual' }],
    });

    expect(mockTranslationRepo.upsert).toHaveBeenCalledWith(1, 'es', expect.objectContaining({ name: 'Actualizado' }));
    expect(result).toBe(refreshed);
  });

  it('leaves omitted locales unchanged when translations not provided', async () => {
    const refreshed = makeProduct({ name: 'Updated' });
    mockRepo.findById.mockResolvedValueOnce(makeProduct()).mockResolvedValueOnce(refreshed);
    mockRepo.update.mockResolvedValue(refreshed);

    await service.update(1, { name: 'Updated' });

    expect(mockTranslationRepo.upsert).not.toHaveBeenCalled();
  });
});

describe('ProductService - deleteTranslation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes a translation for an existing product', async () => {
    mockRepo.findById.mockResolvedValue(makeProduct());
    mockTranslationRepo.delete.mockResolvedValue(undefined);

    await service.deleteTranslation(1, 'es');

    expect(mockTranslationRepo.delete).toHaveBeenCalledWith(1, 'es');
  });

  it('throws ProductNotFoundError when product does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.deleteTranslation(99, 'es')).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('propagates TranslationNotFoundError from repository (404 case)', async () => {
    mockRepo.findById.mockResolvedValue(makeProduct());
    mockTranslationRepo.delete.mockRejectedValue(new TranslationNotFoundError());
    await expect(service.deleteTranslation(1, 'es')).rejects.toBeInstanceOf(TranslationNotFoundError);
  });
});
