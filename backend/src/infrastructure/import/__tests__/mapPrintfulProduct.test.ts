import {
  isImportablePrintfulSyncProduct,
  mapPrintfulProduct,
  isImportableCatalogProduct,
  mapCatalogProduct,
} from '../mapPrintfulProduct';
import { SyncProductDetail, SyncVariant, CatalogProductDetail, CatalogVariant } from '../../external/printfulTypes';

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

// ── Catalog mapper ────────────────────────────────────────────────────────────

const baseCatalogProduct: CatalogProductDetail = {
  id: 679,
  type: 'T-SHIRT',
  type_name: 'T-Shirt',
  title: 'Unisex Performance Tee',
  brand: 'A4',
  model: 'N3142',
  image: 'https://cdn.printful.com/products/679/main.jpg',
};

const makeCatalogVariant = (
  id: number,
  color: string,
  size: string,
  price = '10.00',
  imageUrl = `https://cdn.printful.com/products/679/${id}.jpg`,
): CatalogVariant => ({
  id,
  product_id: 679,
  name: `Unisex Performance Tee — ${color} / ${size}`,
  size,
  color,
  color_code: null,
  image: imageUrl,
  price,
  in_stock: true,
});

describe('mapCatalogProduct', () => {
  it('applies markup to compute publicPrice', () => {
    const mapped = mapCatalogProduct(baseCatalogProduct, [makeCatalogVariant(1, 'Black', 'S')], 1.6);
    expect(mapped.variants[0]?.publicPrice).toBe(16); // 10 * 1.6
    expect(mapped.variants[0]?.supplierCost).toBe(10);
  });

  it('uses PF-CAT- SKU prefix', () => {
    const mapped = mapCatalogProduct(baseCatalogProduct, [makeCatalogVariant(42, 'Black', 'S')], 1.6);
    expect(mapped.variants[0]?.sku).toBe('PF-CAT-42');
  });

  it('sets size and color from direct fields', () => {
    const mapped = mapCatalogProduct(baseCatalogProduct, [makeCatalogVariant(1, 'White', 'M')], 1.5);
    expect(mapped.variants[0]?.color).toBe('White');
    expect(mapped.variants[0]?.size).toBe('M');
  });

  it('de-duplicates images by color — one image per unique color', () => {
    // Black S and Black M share the same color → only 1 image stored
    const variants = [
      makeCatalogVariant(1, 'Black', 'S', '10.00', 'https://cdn/black-s.jpg'),
      makeCatalogVariant(2, 'Black', 'M', '10.00', 'https://cdn/black-m.jpg'),
      makeCatalogVariant(3, 'White', 'S', '10.00', 'https://cdn/white-s.jpg'),
    ];
    const mapped = mapCatalogProduct(baseCatalogProduct, variants, 1.6);
    expect(mapped.images).toHaveLength(2); // Black + White
  });

  it('altText contains product title and color but not size', () => {
    const mapped = mapCatalogProduct(baseCatalogProduct, [makeCatalogVariant(1, 'Navy', 'L')], 1.6);
    expect(mapped.images[0]?.altText).toBe('Unisex Performance Tee — Navy');
    expect(mapped.images[0]?.altText).not.toContain('L');
  });

  it('uses product image as mainImageUrl', () => {
    const mapped = mapCatalogProduct(baseCatalogProduct, [makeCatalogVariant(1, 'Black', 'S')], 1.6);
    expect(mapped.mainImageUrl).toBe('https://cdn.printful.com/products/679/main.jpg');
  });

  it('uses pf-cat-{id}- slug prefix', () => {
    const mapped = mapCatalogProduct(baseCatalogProduct, [makeCatalogVariant(1, 'Black', 'S')], 1.6);
    expect(mapped.slug).toMatch(/^pf-cat-679-/);
  });
});

describe('isImportableCatalogProduct', () => {
  it('returns true when at least one in_stock variant has a price', () => {
    expect(isImportableCatalogProduct([makeCatalogVariant(1, 'Black', 'S')])).toBe(true);
  });

  it('returns false when all variants are out of stock', () => {
    const oos: CatalogVariant = { ...makeCatalogVariant(1, 'Black', 'S'), in_stock: false };
    expect(isImportableCatalogProduct([oos])).toBe(false);
  });

  it('returns false when all variants have zero price', () => {
    const free: CatalogVariant = { ...makeCatalogVariant(1, 'Black', 'S'), price: '0' };
    expect(isImportableCatalogProduct([free])).toBe(false);
  });

  it('returns false for empty list', () => {
    expect(isImportableCatalogProduct([])).toBe(false);
  });
});
