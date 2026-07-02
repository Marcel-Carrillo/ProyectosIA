import { mapSupplierFeedProduct } from '../mapSupplierFeedProduct';
import { SupplierFeedProduct } from '../../external/supplierFeedTypes';

const baseProduct: SupplierFeedProduct = {
  supplier: { name: 'Atelier Nord', reference: 'SUP-AN-001' },
  externalRef: 'AN-DRESS-001',
  title: 'Belted Midi Wrap Dress',
  description: 'A wrap dress with a self-tie belt, cut from a soft crepe.',
  brand: 'Atelier Nord',
  category: 'Dresses',
  supplierCost: 18.5,
  images: [],
  variants: [
    { sku: 'AN-DRESS-001-S', size: 'S', publicPrice: 49.99 },
    { sku: 'AN-DRESS-001-M', size: 'M', publicPrice: 49.99 },
  ],
};

describe('mapSupplierFeedProduct', () => {
  it('maps an empty-images product to a Draft product with no image field', () => {
    const mapped = mapSupplierFeedProduct(baseProduct);

    expect(mapped.status).toBe('Draft');
    expect(mapped.mainImageUrl).toBeNull();
    expect(mapped).not.toHaveProperty('images');
  });

  it('routes supplierCost and supplierReference onto every mapped variant', () => {
    const mapped = mapSupplierFeedProduct(baseProduct);

    for (const variant of mapped.variants) {
      expect(variant.supplierCost).toBe(18.5);
      expect(variant.supplierReference).toBe('AN-DRESS-001');
    }
  });

  it('does not source supplierReference from supplier.reference', () => {
    const mapped = mapSupplierFeedProduct(baseProduct);

    expect(mapped.variants[0]?.supplierReference).not.toBe('SUP-AN-001');
  });

  it('generates a slug from the title', () => {
    const mapped = mapSupplierFeedProduct(baseProduct);

    expect(mapped.slug).toBe('belted-midi-wrap-dress');
  });

  it('maps multiple variants with SupplierManaged stock policy and Active status', () => {
    const mapped = mapSupplierFeedProduct(baseProduct);

    expect(mapped.variants).toHaveLength(2);
    for (const variant of mapped.variants) {
      expect(variant.stockPolicy).toBe('SupplierManaged');
      expect(variant.status).toBe('Active');
    }
  });

  it('maps missing size/color to null, not undefined', () => {
    const mapped = mapSupplierFeedProduct({
      ...baseProduct,
      variants: [{ sku: 'AN-DRESS-001-ONE', publicPrice: 49.99 }],
    });

    expect(mapped.variants[0]?.size).toBeNull();
    expect(mapped.variants[0]?.color).toBeNull();
  });

  it('falls back to null when description or brand is empty or whitespace-only', () => {
    const mapped = mapSupplierFeedProduct({
      ...baseProduct,
      description: '   ',
      brand: '',
    });

    expect(mapped.description).toBeNull();
    expect(mapped.brand).toBeNull();
  });
});
