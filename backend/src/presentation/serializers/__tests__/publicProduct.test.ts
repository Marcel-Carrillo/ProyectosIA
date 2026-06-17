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
    status: 'Active',
    mainImageUrl: 'https://img/main.jpg',
    categoryId: 3,
    variants: [
      { productId: 1, sku: 'EJS-1', publicPrice: 20, status: 'Active', stockPolicy: 'SupplierManaged' },
      { productId: 1, sku: 'EJS-1-OLD', publicPrice: 10, status: 'Inactive', stockPolicy: 'SupplierManaged' },
    ],
    images: [
      { productId: 1, url: 'https://img/2.jpg', sortOrder: 2 },
      { productId: 1, url: 'https://img/0.jpg', sortOrder: 0 },
      { productId: 1, url: 'https://img/1.jpg', sortOrder: 1 },
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
      ['color', 'compareAtPrice', 'id', 'publicPrice', 'sku', 'size', 'status'].sort(),
    );
  });

  it('includes only Active variants', () => {
    const dto = serializePublicProduct(makeProduct());
    expect(dto.variants).toHaveLength(1);
    expect(dto.variants[0]?.sku).toBe('EJS-1');
  });

  it('orders images by sortOrder', () => {
    const dto = serializePublicProduct(makeProduct());
    expect(dto.images.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
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
});
