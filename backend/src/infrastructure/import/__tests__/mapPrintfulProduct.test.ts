import {
  isImportablePrintfulSyncProduct,
  mapPrintfulProduct,
} from '../mapPrintfulProduct';
import { SyncProductDetail, SyncVariant } from '../../external/printfulTypes';

const baseVariant: SyncVariant = {
  id: 100,
  external_id: 'ext-100',
  sync_product_id: 1,
  name: 'Unisex T-Shirt / S / Red',
  synced: true,
  variant_id: 4011,
  retail_price: '15.00',
  currency: 'USD',
  is_ignored: false,
  options: [
    { id: 'SIZE', value: 'S' },
    { id: 'COLOR', value: 'Red' },
  ],
  files: [{ type: 'preview', preview_url: 'https://cdn.printful.com/products/71/preview.jpg' }],
  product: { type: 'T-Shirt' },
};

const baseSyncProduct: SyncProductDetail = {
  id: 1,
  external_id: 'ext-1',
  name: 'Unisex Heavy Cotton Tee',
  variants: 1,
  synced: 1,
  thumbnail_url: 'https://cdn.printful.com/products/71/thumb.jpg',
  is_ignored: false,
};

describe('mapPrintfulProduct', () => {
  it('applies markup to compute publicPrice', () => {
    const mapped = mapPrintfulProduct(baseSyncProduct, [baseVariant], 1.6);
    expect(mapped.variants[0]?.publicPrice).toBe(24); // 15 * 1.6 = 24
    expect(mapped.variants[0]?.supplierCost).toBe(15);
  });

  it('rounds publicPrice to 2 decimal places', () => {
    const variantOddPrice: SyncVariant = { ...baseVariant, retail_price: '9.99' };
    const mapped = mapPrintfulProduct(baseSyncProduct, [variantOddPrice], 1.6);
    // 9.99 * 1.6 = 15.984 → rounds to 15.98
    expect(mapped.variants[0]?.publicPrice).toBe(15.98);
  });

  it('extracts size and color from options (case-insensitive)', () => {
    const variantLower: SyncVariant = {
      ...baseVariant,
      options: [
        { id: 'size', value: 'M' },
        { id: 'color', value: 'Blue' },
      ],
    };
    const mapped = mapPrintfulProduct(baseSyncProduct, [variantLower], 1.5);
    expect(mapped.variants[0]?.size).toBe('M');
    expect(mapped.variants[0]?.color).toBe('Blue');
  });

  it('returns null for missing color option', () => {
    const variantNoColor: SyncVariant = {
      ...baseVariant,
      options: [{ id: 'SIZE', value: 'L' }],
    };
    const mapped = mapPrintfulProduct(baseSyncProduct, [variantNoColor], 1.5);
    expect(mapped.variants[0]?.color).toBeNull();
  });

  it('returns null for missing size option', () => {
    const variantNoSize: SyncVariant = {
      ...baseVariant,
      options: [{ id: 'COLOR', value: 'White' }],
    };
    const mapped = mapPrintfulProduct(baseSyncProduct, [variantNoSize], 1.5);
    expect(mapped.variants[0]?.size).toBeNull();
  });

  it('sets sku as PF-{id}', () => {
    const mapped = mapPrintfulProduct(baseSyncProduct, [baseVariant], 1.6);
    expect(mapped.variants[0]?.sku).toBe('PF-100');
  });

  it('sets supplierReference as string of id', () => {
    const mapped = mapPrintfulProduct(baseSyncProduct, [baseVariant], 1.6);
    expect(mapped.variants[0]?.supplierReference).toBe('100');
  });

  it('sets stockPolicy to SupplierManaged', () => {
    const mapped = mapPrintfulProduct(baseSyncProduct, [baseVariant], 1.6);
    expect(mapped.variants[0]?.stockPolicy).toBe('SupplierManaged');
  });

  it('derives slug with pf- prefix', () => {
    const mapped = mapPrintfulProduct(baseSyncProduct, [baseVariant], 1.6);
    expect(mapped.slug).toBe('pf-unisex-heavy-cotton-tee');
  });

  it('derives categoryName from first variant product.type', () => {
    const mapped = mapPrintfulProduct(baseSyncProduct, [baseVariant], 1.6);
    expect(mapped.categoryName).toBe('T-Shirt');
  });

  it('falls back to Apparel when product.type is empty', () => {
    const variantNoType: SyncVariant = { ...baseVariant, product: { type: '' } };
    const mapped = mapPrintfulProduct(baseSyncProduct, [variantNoType], 1.6);
    expect(mapped.categoryName).toBe('Apparel');
  });

  it('excludes is_ignored variants', () => {
    const ignoredVariant: SyncVariant = { ...baseVariant, id: 200, is_ignored: true };
    const mapped = mapPrintfulProduct(baseSyncProduct, [baseVariant, ignoredVariant], 1.6);
    expect(mapped.variants).toHaveLength(1);
    expect(mapped.variants[0]?.sku).toBe('PF-100');
  });

  it('de-duplicates images across variants', () => {
    const sameUrlVariant: SyncVariant = {
      ...baseVariant,
      id: 101,
      retail_price: '16.00',
      files: [{ type: 'preview', preview_url: 'https://cdn.printful.com/products/71/preview.jpg' }],
    };
    const mapped = mapPrintfulProduct(baseSyncProduct, [baseVariant, sameUrlVariant], 1.6);
    expect(mapped.images).toHaveLength(1);
  });
});

describe('isImportablePrintfulSyncProduct', () => {
  it('returns true when at least one non-ignored variant has a price', () => {
    expect(isImportablePrintfulSyncProduct([baseVariant])).toBe(true);
  });

  it('returns false when all variants are ignored', () => {
    const ignored: SyncVariant = { ...baseVariant, is_ignored: true };
    expect(isImportablePrintfulSyncProduct([ignored])).toBe(false);
  });

  it('returns false when all variants have zero retail_price', () => {
    const zeroPrice: SyncVariant = { ...baseVariant, retail_price: '0' };
    expect(isImportablePrintfulSyncProduct([zeroPrice])).toBe(false);
  });

  it('returns false for empty variant list', () => {
    expect(isImportablePrintfulSyncProduct([])).toBe(false);
  });
});
