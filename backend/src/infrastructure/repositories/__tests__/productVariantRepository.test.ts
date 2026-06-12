import { ProductVariant } from '../../../domain/models/productVariant';

describe('ProductVariant domain model - supplier field exclusion', () => {
  it('should NOT expose supplierId on the ProductVariant model', () => {
    const variant = new ProductVariant({
      id: 1,
      productId: 1,
      sku: 'SKU-001',
      publicPrice: 29.99,
      stockPolicy: 'SupplierManaged',
    });
    expect((variant as unknown as Record<string, unknown>)['supplierId']).toBeUndefined();
    expect((variant as unknown as Record<string, unknown>)['supplierReference']).toBeUndefined();
    expect((variant as unknown as Record<string, unknown>)['supplierCost']).toBeUndefined();
  });

  it('should NOT expose supplier fields when serializing to JSON', () => {
    const variant = new ProductVariant({
      id: 1,
      productId: 1,
      sku: 'SKU-001',
      publicPrice: 29.99,
      stockPolicy: 'SupplierManaged',
    });
    const json = JSON.stringify(variant);
    expect(json).not.toContain('supplierId');
    expect(json).not.toContain('supplierReference');
    expect(json).not.toContain('supplierCost');
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
