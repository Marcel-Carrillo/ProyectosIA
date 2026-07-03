import React from 'react';
import { waitFor } from '@testing-library/react';
import ProductPage from '../ProductPage';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';

const mockGetById = jest.fn();
const mockCategoryGetAll = jest.fn();

jest.mock('react-router-dom', () => ({
  useParams: () => ({ id: '1' }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

jest.mock('../../../contexts/CartContext', () => ({
  useCart: () => ({ addItem: jest.fn() }),
}));

jest.mock('../../../services/productService', () => ({
  productService: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
}));

jest.mock('../../../services/categoryService', () => ({
  categoryService: {
    getAll: (...args: unknown[]) => mockCategoryGetAll(...args),
  },
}));

describe('ProductPage language refetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCategoryGetAll.mockResolvedValue([]);
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Dress',
        slug: 'dress',
        description: 'A dress',
        brand: null,
        gtin: null,
        status: 'Active',
        mainImageUrl: null,
        categoryId: null,
        createdAt: '',
        updatedAt: '',
      },
    });
  });

  it('refetches product when language changes', async () => {
    const { i18n } = renderWithI18n(<ProductPage />, { lng: 'en' });

    await waitFor(() => expect(mockGetById).toHaveBeenCalledTimes(1));

    await i18n.changeLanguage('es');

    await waitFor(() => expect(mockGetById).toHaveBeenCalledTimes(2));
  });
});

describe('ProductPage structured data - gtin', () => {
  const baseProduct = {
    id: 1,
    name: 'Dress',
    slug: 'dress',
    description: 'A dress',
    brand: null,
    status: 'Active',
    mainImageUrl: null,
    categoryId: null,
    createdAt: '',
    updatedAt: '',
  };

  const getProductJsonLd = async () => {
    const scripts = await waitFor(() => {
      const found = document.querySelectorAll('script[type="application/ld+json"]');
      expect(found.length).toBeGreaterThan(0);
      return found;
    });
    return JSON.parse(scripts[0].textContent ?? '{}');
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCategoryGetAll.mockResolvedValue([]);
  });

  it('emits gtin13 for a 13-digit gtin', async () => {
    mockGetById.mockResolvedValue({ data: { ...baseProduct, gtin: '4006381333931' } });
    renderWithI18n(<ProductPage />, { lng: 'en' });
    const jsonLd = await getProductJsonLd();
    expect(jsonLd.gtin13).toBe('4006381333931');
    expect(jsonLd.gtin).toBeUndefined();
  });

  it('emits generic gtin for an 8, 12, or 14-digit gtin', async () => {
    mockGetById.mockResolvedValue({ data: { ...baseProduct, gtin: '12345678' } });
    renderWithI18n(<ProductPage />, { lng: 'en' });
    const jsonLd = await getProductJsonLd();
    expect(jsonLd.gtin).toBe('12345678');
    expect(jsonLd.gtin13).toBeUndefined();
  });

  it('omits gtin and gtin13 from structured data when product.gtin is null', async () => {
    mockGetById.mockResolvedValue({ data: { ...baseProduct, gtin: null } });
    renderWithI18n(<ProductPage />, { lng: 'en' });
    const jsonLd = await getProductJsonLd();
    expect(jsonLd.gtin).toBeUndefined();
    expect(jsonLd.gtin13).toBeUndefined();
  });
});
