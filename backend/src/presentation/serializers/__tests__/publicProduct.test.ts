import { Product } from '../../../domain/models/product';
import { ProductVariant } from '../../../domain/models/productVariant';
import { serializePublicProduct } from '../publicProduct';

const makeProduct = () =>
  new Product({
    id: 1,
    name: 'Summer Dress',
    slug: 'summer-dress',
    description: 'A light dress',
    brand: 'Acme',
    gtin: '5901234123457',
    status: 'Active',
    mainImageUrl: 'https://img/main.jpg',
    categoryId: 3,
    variants: [
      { productId: 1, sku: 'EJS-1', publicPrice: 20, status: 'Active', stockPolicy: 'SupplierManaged', stockQuantity: 8 },
      { productId: 1, sku: 'EJS-1-OLD', publicPrice: 10, status: 'Inactive', stockPolicy: 'SupplierManaged', stockQuantity: 0 },
    ],
    images: [
      { productId: 1, url: 'https://img/2.jpg', sortOrder: 2, color: 'Red' },
      { productId: 1, url: 'https://img/0.jpg', sortOrder: 0, color: null },
      { productId: 1, url: 'https://img/1.jpg', sortOrder: 1, color: 'Blue' },
    ],
  });

describe('serializePublicProduct', () => {
  it('exposes only the customer-safe allow-list of fields', () => {
    const dto = serializePublicProduct(makeProduct());
    expect(Object.keys(dto).sort()).toEqual(
      [
        'brand',
        'categoryId',
        'createdAt',
        'description',
        'gtin',
        'id',
        'images',
        'mainImageUrl',
        'name',
        'slug',
        'status',
        'updatedAt',
        'variants',
      ].sort(),
    );
    expect(Object.keys(dto.variants[0]).sort()).toEqual(
      ['color', 'compareAtPrice', 'id', 'publicPrice', 'sku', 'size', 'status', 'stockQuantity'].sort(),
    );
  });

  it('includes only Active variants', () => {
    const dto = serializePublicProduct(makeProduct());
    expect(dto.variants).toHaveLength(1);
    expect(dto.variants[0]?.sku).toBe('EJS-1');
  });

  it('includes the variant stockQuantity', () => {
    const dto = serializePublicProduct(makeProduct());
    expect(dto.variants[0]?.stockQuantity).toBe(8);
  });

  it('orders images by sortOrder', () => {
    const dto = serializePublicProduct(makeProduct());
    expect(dto.images.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
  });

  it('exposes only the customer-safe allow-list of image fields', () => {
    const dto = serializePublicProduct(makeProduct());
    expect(Object.keys(dto.images[0]!).sort()).toEqual(['altText', 'color', 'id', 'sortOrder', 'url'].sort());
  });

  it('includes each image color, with null for shared/product-level images', () => {
    const dto = serializePublicProduct(makeProduct());
    // Ordered by sortOrder: 0 (null), 1 (Blue), 2 (Red)
    expect(dto.images.map((i) => i.color)).toEqual([null, 'Blue', 'Red']);
  });

  it('includes the gtin value when present', () => {
    const dto = serializePublicProduct(makeProduct());
    expect(dto.gtin).toBe('5901234123457');
  });

  it('includes gtin as null when the product has no gtin', () => {
    const product = new Product({ id: 1, name: 'Summer Dress', slug: 'summer-dress', status: 'Active' });
    const dto = serializePublicProduct(product);
    expect(dto.gtin).toBeNull();
  });

  it('returns ES translation when locale is es', () => {
    const product = new Product({
      id: 1, name: 'Summer Dress', slug: 'summer-dress', status: 'Active',
      translations: [{ productId: 1, locale: 'es', name: 'Vestido de Verano', description: 'Un vestido ligero', source: 'manual' }],
    });
    const dto = serializePublicProduct(product, 'es');
    expect(dto.name).toBe('Vestido de Verano');
    expect(dto.description).toBe('Un vestido ligero');
  });

  it('returns EN translation when locale is en and EN translation exists', () => {
    const product = new Product({
      id: 1, name: 'Summer Dress', slug: 'summer-dress', status: 'Active',
      translations: [
        { productId: 1, locale: 'en', name: 'Summer Dress EN', description: 'EN desc', source: 'manual' },
        { productId: 1, locale: 'es', name: 'Vestido', description: null, source: 'manual' },
      ],
    });
    const dto = serializePublicProduct(product, 'en');
    expect(dto.name).toBe('Summer Dress EN');
  });

  it('falls back to EN translation when ES translation is missing', () => {
    const product = new Product({
      id: 1, name: 'Summer Dress', slug: 'summer-dress', status: 'Active',
      translations: [{ productId: 1, locale: 'en', name: 'Summer Dress EN', description: 'EN desc', source: 'manual' }],
    });
    const dto = serializePublicProduct(product, 'es');
    expect(dto.name).toBe('Summer Dress EN');
  });

  it('falls back to Product.name when no translations exist', () => {
    const product = new Product({ id: 1, name: 'Summer Dress', slug: 'summer-dress', status: 'Active' });
    const dto = serializePublicProduct(product, 'es');
    expect(dto.name).toBe('Summer Dress');
  });

  it('handles region-stripped locale (es-ES → es)', () => {
    const product = new Product({
      id: 1, name: 'Summer Dress', slug: 'summer-dress', status: 'Active',
      translations: [{ productId: 1, locale: 'es', name: 'Vestido', description: null, source: 'manual' }],
    });
    const dto = serializePublicProduct(product, 'es-ES');
    expect(dto.name).toBe('Vestido');
  });

  it('never emits supplier or internal fields, even if present on the entity', () => {
    const product = makeProduct();
    // Simulate a future model leak: attach supplier/internal data onto the entity.
    const variant = product.variants?.[0] as ProductVariant & Record<string, unknown>;
    variant['supplierId'] = 7;
    variant['supplierReference'] = 'SUP-REF';
    variant['supplierCost'] = 9.99;
    variant['deletedAt'] = new Date();
    (product as unknown as Record<string, unknown>)['deletedAt'] = new Date();

    const dto = serializePublicProduct(product);
    const json = JSON.stringify(dto);

    expect(json).not.toContain('supplierId');
    expect(json).not.toContain('supplierReference');
    expect(json).not.toContain('supplierCost');
    expect(json).not.toContain('deletedAt');
  });

  it('never emits admin-only margin fields, even if present on the entity', () => {
    const product = makeProduct();
    // Simulate a future model leak: attach admin-only margin data onto the entity.
    const variant = product.variants?.[0] as ProductVariant & Record<string, unknown>;
    variant['shippingCostEstimate'] = 4.5;
    variant['netMargin'] = 12.34;
    variant['shippingEstimateMissing'] = false;
    variant['marginWarning'] = true;

    const dto = serializePublicProduct(product);
    const json = JSON.stringify(dto);

    expect(json).not.toContain('shippingCostEstimate');
    expect(json).not.toContain('netMargin');
    expect(json).not.toContain('shippingEstimateMissing');
    expect(json).not.toContain('marginWarning');
  });
});
