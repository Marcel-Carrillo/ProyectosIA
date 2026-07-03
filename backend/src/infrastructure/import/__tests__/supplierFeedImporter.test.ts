import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import {
  cleanLocalCatalog,
  importSupplierFeedProducts,
  readSupplierFeedFixture,
} from '../supplierFeedImporter';
import { SupplierFeedProduct } from '../../external/supplierFeedTypes';

function createMockPrisma() {
  return {
    product: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
    productVariant: { deleteMany: jest.fn(), createMany: jest.fn() },
    productImage: { deleteMany: jest.fn() },
    category: { upsert: jest.fn() },
    supplier: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    stripeWebhookEvent: { deleteMany: jest.fn() },
    couponRedemption: { deleteMany: jest.fn() },
    refund: { deleteMany: jest.fn() },
    returnRequest: { deleteMany: jest.fn() },
    shipment: { deleteMany: jest.fn() },
    supplierOrderItem: { deleteMany: jest.fn() },
    supplierOrder: { deleteMany: jest.fn() },
    customerOrderItem: { deleteMany: jest.fn() },
    customerOrder: { deleteMany: jest.fn() },
    wishlistItem: { deleteMany: jest.fn() },
  };
}

const baseFixtureProduct: SupplierFeedProduct = {
  supplier: { name: 'Atelier Nord', reference: 'SUP-AN-001' },
  externalRef: 'AN-DRESS-001',
  title: 'Belted Midi Wrap Dress',
  description: 'A wrap dress with a self-tie belt.',
  brand: 'Atelier Nord',
  ean: '5901234123457',
  category: 'Dresses',
  supplierCost: 18.5,
  images: [],
  variants: [
    { sku: 'AN-DRESS-001-S', size: 'S', publicPrice: 49.99 },
    { sku: 'AN-DRESS-001-M', size: 'M', publicPrice: 49.99 },
  ],
};

const EXPECTED_CLEAN_ORDER = [
  'stripeWebhookEvent',
  'couponRedemption',
  'refund',
  'returnRequest',
  'shipment',
  'supplierOrderItem',
  'supplierOrder',
  'customerOrderItem',
  'customerOrder',
  'wishlistItem',
  'productImage',
  'productVariant',
  'product',
] as const;

describe('cleanLocalCatalog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes every order/shipment/return/refund/wishlist/catalog table in FK-safe order', async () => {
    const mockPrisma = createMockPrisma();
    const callOrder: string[] = [];
    const tables: Record<(typeof EXPECTED_CLEAN_ORDER)[number], { deleteMany: jest.Mock }> = mockPrisma;
    for (const table of EXPECTED_CLEAN_ORDER) {
      tables[table].deleteMany.mockImplementation(async () => {
        callOrder.push(table);
      });
    }

    await cleanLocalCatalog(mockPrisma as unknown as Prisma.TransactionClient);

    expect(callOrder).toEqual([...EXPECTED_CLEAN_ORDER]);
    expect(mockPrisma.category.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.supplier.findFirst).not.toHaveBeenCalled();
  });
});

describe('importSupplierFeedProducts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a new supplier, category, and product on first import', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.supplier.findFirst.mockResolvedValue(null);
    mockPrisma.supplier.create.mockResolvedValue({ id: 1 });
    mockPrisma.category.upsert.mockResolvedValue({ id: 1 });
    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 });

    const result = await importSupplierFeedProducts(mockPrisma as unknown as Prisma.TransactionClient, [
      baseFixtureProduct,
    ]);

    expect(mockPrisma.supplier.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.category.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.product.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      suppliersUpserted: 1,
      categoriesUpserted: 1,
      productsCreated: 1,
      variantsCreated: 2,
      imagesCreated: 0,
    });

    const createCall = mockPrisma.product.create.mock.calls[0][0];
    expect(createCall.data.status).toBe('Draft');
    expect(createCall.data.mainImageUrl).toBeNull();
    expect(createCall.data.gtin).toBe('5901234123457');
  });

  it('re-activates an existing Inactive supplier instead of creating a duplicate', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: 5, status: 'Inactive' });
    mockPrisma.category.upsert.mockResolvedValue({ id: 1 });
    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 });

    await importSupplierFeedProducts(mockPrisma as unknown as Prisma.TransactionClient, [baseFixtureProduct]);

    expect(mockPrisma.supplier.create).not.toHaveBeenCalled();
    expect(mockPrisma.supplier.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: 'Active' },
    });
  });

  it('does not re-activate an already-Active existing supplier', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: 5, status: 'Active' });
    mockPrisma.category.upsert.mockResolvedValue({ id: 1 });
    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 });

    await importSupplierFeedProducts(mockPrisma as unknown as Prisma.TransactionClient, [baseFixtureProduct]);

    expect(mockPrisma.supplier.update).not.toHaveBeenCalled();
  });

  it('updates an existing product and replaces its variants without touching ProductImage', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: 5, status: 'Active' });
    mockPrisma.category.upsert.mockResolvedValue({ id: 1 });
    mockPrisma.product.findUnique.mockResolvedValue({ id: 42 });

    const result = await importSupplierFeedProducts(mockPrisma as unknown as Prisma.TransactionClient, [
      baseFixtureProduct,
    ]);

    expect(mockPrisma.product.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.product.create).not.toHaveBeenCalled();
    const updateCall = mockPrisma.product.update.mock.calls[0][0];
    expect(updateCall.data.gtin).toBe('5901234123457');
    expect(mockPrisma.productVariant.deleteMany).toHaveBeenCalledWith({ where: { productId: 42 } });
    expect(mockPrisma.productVariant.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.productImage.deleteMany).not.toHaveBeenCalled();
    expect(result.productsCreated).toBe(0);
    expect(result.imagesCreated).toBe(0);
  });

  it('propagates a null gtin on create when the feed entry has no ean', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.supplier.findFirst.mockResolvedValue(null);
    mockPrisma.supplier.create.mockResolvedValue({ id: 1 });
    mockPrisma.category.upsert.mockResolvedValue({ id: 1 });
    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ean: _ean, ...productWithoutEan } = baseFixtureProduct;

    await importSupplierFeedProducts(mockPrisma as unknown as Prisma.TransactionClient, [
      productWithoutEan as SupplierFeedProduct,
    ]);

    const createCall = mockPrisma.product.create.mock.calls[0][0];
    expect(createCall.data.gtin).toBeNull();
  });

  it('is idempotent: re-running the import does not create a duplicate product', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: 5, status: 'Active' });
    mockPrisma.category.upsert.mockResolvedValue({ id: 1 });
    mockPrisma.product.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 42 });
    mockPrisma.product.create.mockResolvedValue({ id: 42 });

    await importSupplierFeedProducts(mockPrisma as unknown as Prisma.TransactionClient, [baseFixtureProduct]);
    await importSupplierFeedProducts(mockPrisma as unknown as Prisma.TransactionClient, [baseFixtureProduct]);

    // First pass: create branch (variants nested inside product.create, no
    // separate productVariant.createMany call). Second pass: update branch
    // (delete-then-recreate via productVariant.createMany).
    expect(mockPrisma.product.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.product.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.productVariant.createMany).toHaveBeenCalledTimes(1);
  });
});

describe('readSupplierFeedFixture', () => {
  const tmpDir = os.tmpdir();
  const validPath = path.join(tmpDir, 'supplier-feed-valid.json');
  const invalidJsonPath = path.join(tmpDir, 'supplier-feed-invalid.json');
  const notArrayPath = path.join(tmpDir, 'supplier-feed-not-array.json');
  const missingFieldsPath = path.join(tmpDir, 'supplier-feed-missing-fields.json');
  const duplicateSlugPath = path.join(tmpDir, 'supplier-feed-duplicate-slug.json');
  const duplicateSkuPath = path.join(tmpDir, 'supplier-feed-duplicate-sku.json');

  beforeAll(() => {
    fs.writeFileSync(validPath, JSON.stringify([baseFixtureProduct]));
    fs.writeFileSync(invalidJsonPath, '{ not valid json');
    fs.writeFileSync(notArrayPath, JSON.stringify({ not: 'an array' }));
    fs.writeFileSync(
      missingFieldsPath,
      JSON.stringify([{ ...baseFixtureProduct, title: '' }]),
    );
    fs.writeFileSync(
      duplicateSlugPath,
      JSON.stringify([baseFixtureProduct, { ...baseFixtureProduct, variants: [{ sku: 'OTHER-SKU', publicPrice: 10 }] }]),
    );
    fs.writeFileSync(
      duplicateSkuPath,
      JSON.stringify([
        baseFixtureProduct,
        { ...baseFixtureProduct, title: 'A Different Title', variants: [{ sku: 'AN-DRESS-001-S', publicPrice: 10 }] },
      ]),
    );
  });

  afterAll(() => {
    for (const file of [
      validPath,
      invalidJsonPath,
      notArrayPath,
      missingFieldsPath,
      duplicateSlugPath,
      duplicateSkuPath,
    ]) {
      fs.unlinkSync(file);
    }
  });

  it('parses a valid fixture array', () => {
    const products = readSupplierFeedFixture(validPath);
    expect(products).toHaveLength(1);
    expect(products[0]?.title).toBe('Belted Midi Wrap Dress');
  });

  it('throws when the fixture file is missing', () => {
    expect(() => readSupplierFeedFixture(path.join(tmpDir, 'does-not-exist.json'))).toThrow(
      /not found/,
    );
  });

  it('throws when the fixture is not valid JSON', () => {
    expect(() => readSupplierFeedFixture(invalidJsonPath)).toThrow(/not valid JSON/);
  });

  it('throws when the fixture is valid JSON but not an array', () => {
    expect(() => readSupplierFeedFixture(notArrayPath)).toThrow(/must be a JSON array/);
  });

  it('throws a descriptive error when a product entry is missing required fields', () => {
    expect(() => readSupplierFeedFixture(missingFieldsPath)).toThrow(/missing "title"/);
  });

  it('throws when two entries generate the same slug', () => {
    expect(() => readSupplierFeedFixture(duplicateSlugPath)).toThrow(/duplicate product title\/slug/);
  });

  it('throws when two entries share a variant SKU', () => {
    expect(() => readSupplierFeedFixture(duplicateSkuPath)).toThrow(/duplicate variant SKU/);
  });
});
