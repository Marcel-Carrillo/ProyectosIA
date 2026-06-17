import {
  isImportableEscuelaJsProduct,
  mapEscuelaJsProduct,
} from '../mapEscuelaJsProduct';
import { EscuelaJsProduct } from '../../external/escuelaJsTypes';

const baseProduct: EscuelaJsProduct = {
  id: 37,
  title: 'Chic Summer Denim Espadrille Sandals',
  slug: 'chic-summer-denim-espadrille-sandals',
  price: 33,
  description: 'Step into summer with style.',
  category: {
    id: 4,
    name: 'Shoes',
    slug: 'shoes',
    image: 'https://i.imgur.com/qNOjJje.jpeg',
    creationAt: '2026-06-17T00:44:45.000Z',
    updatedAt: '2026-06-17T00:44:45.000Z',
  },
  images: [
    'https://i.imgur.com/9qrmE1b.jpeg',
    'https://i.imgur.com/wqKxBVH.jpeg',
  ],
  creationAt: '2026-06-17T00:44:45.000Z',
  updatedAt: '2026-06-17T00:44:45.000Z',
};

describe('mapEscuelaJsProduct', () => {
  it('maps external product fields to internal import shape', () => {
    const mapped = mapEscuelaJsProduct(baseProduct);

    expect(mapped.name).toBe('Chic Summer Denim Espadrille Sandals');
    expect(mapped.slug).toBe('chic-summer-denim-espadrille-sandals');
    expect(mapped.status).toBe('Active');
    expect(mapped.categoryName).toBe('Shoes');
    expect(mapped.mainImageUrl).toBe('https://i.imgur.com/9qrmE1b.jpeg');
    expect(mapped.variant.sku).toBe('EJS-37');
    expect(mapped.variant.publicPrice).toBe(33);
    expect(mapped.variant.stockPolicy).toBe('SupplierManaged');
    expect(mapped.images).toHaveLength(2);
    expect(mapped.images[0]?.sortOrder).toBe(0);
  });

  it('rejects test junk products', () => {
    expect(
      isImportableEscuelaJsProduct({
        ...baseProduct,
        title: 'test_e016fbb3',
        slug: 'test-e016fbb3',
      }),
    ).toBe(false);

    expect(
      isImportableEscuelaJsProduct({
        ...baseProduct,
        category: { ...baseProduct.category, name: 'test_344bc060' },
      }),
    ).toBe(false);
  });

  it('rejects products without images or invalid price', () => {
    expect(isImportableEscuelaJsProduct({ ...baseProduct, images: [] })).toBe(false);
    expect(isImportableEscuelaJsProduct({ ...baseProduct, price: 0 })).toBe(false);
  });
});
