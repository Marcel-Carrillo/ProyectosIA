import { vi } from 'vitest';
import React from 'react';
import { waitFor, screen, within, fireEvent } from '@testing-library/react';
import ProductPage from '../ProductPage';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';

const mockGetById = vi.fn();
const mockCategoryGetAll = vi.fn();
const mockListApprovedForProduct = vi.fn();

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: '1' }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('../../../contexts/CartContext', () => ({
  useCart: () => ({ addItem: vi.fn() }),
}));

vi.mock('../../../contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({ isAuthenticated: false, isLoading: false }),
}));

vi.mock('../../../services/productService', () => ({
  productService: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
}));

vi.mock('../../../services/categoryService', () => ({
  categoryService: {
    getAll: (...args: unknown[]) => mockCategoryGetAll(...args),
  },
}));

vi.mock('../../../services/reviewService', () => ({
  reviewService: {
    listApprovedForProduct: (...args: unknown[]) => mockListApprovedForProduct(...args),
  },
}));

describe('ProductPage language refetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategoryGetAll.mockResolvedValue([]);
    mockListApprovedForProduct.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 5,
      summary: { averageRating: null, reviewCount: 0 },
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
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
        reviewSummary: { averageRating: null, reviewCount: 0 },
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

describe('ProductPage structured data — gtin', () => {
  const baseProduct = {
    id: 1,
    name: 'Dress',
    slug: 'dress',
    description: 'A dress',
    brand: null,
    status: 'Active',
    mainImageUrl: null,
    categoryId: null,
    reviewSummary: { averageRating: null, reviewCount: 0 },
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
    vi.clearAllMocks();
    mockCategoryGetAll.mockResolvedValue([]);
    mockListApprovedForProduct.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 5,
      summary: { averageRating: null, reviewCount: 0 },
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
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

describe('ProductPage structured data — reviews', () => {
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
    vi.clearAllMocks();
    mockCategoryGetAll.mockResolvedValue([]);
  });

  it('omits aggregateRating and review when reviewCount is 0', async () => {
    mockGetById.mockResolvedValue({
      data: { ...baseProduct, reviewSummary: { averageRating: null, reviewCount: 0 } },
    });
    mockListApprovedForProduct.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 5,
      summary: { averageRating: null, reviewCount: 0 },
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });

    renderWithI18n(<ProductPage />, { lng: 'en' });
    const jsonLd = await getProductJsonLd();

    expect(jsonLd.aggregateRating).toBeUndefined();
    expect(jsonLd.review).toBeUndefined();
  });

  it('includes aggregateRating and review when reviewCount >= 1', async () => {
    mockGetById.mockResolvedValue({
      data: { ...baseProduct, reviewSummary: { averageRating: 4.5, reviewCount: 2 } },
    });
    mockListApprovedForProduct.mockResolvedValue({
      items: [
        {
          id: 1,
          productId: 1,
          rating: 5,
          title: 'Great',
          body: 'Loved it',
          authorNameSnapshot: 'María C.',
          createdAt: '2026-05-01T00:00:00Z',
        },
        {
          id: 2,
          productId: 1,
          rating: 4,
          title: null,
          body: null,
          authorNameSnapshot: 'Ana G.',
          createdAt: '2026-05-02T00:00:00Z',
        },
      ],
      total: 2,
      page: 1,
      pageSize: 5,
      summary: { averageRating: 4.5, reviewCount: 2 },
      distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
    });

    renderWithI18n(<ProductPage />, { lng: 'en' });
    const jsonLd = await getProductJsonLd();

    expect(jsonLd.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.5,
      reviewCount: 2,
      bestRating: 5,
      worstRating: 1,
    });
    expect(jsonLd.review).toHaveLength(2);
    expect(jsonLd.review[0]).toEqual({
      '@type': 'Review',
      author: { '@type': 'Person', name: 'María C.' },
      reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5, worstRating: 1 },
      reviewBody: 'Loved it',
      datePublished: '2026-05-01T00:00:00Z',
    });
    // second review has no body — reviewBody key must be entirely absent, not null/''
    expect(jsonLd.review[1].reviewBody).toBeUndefined();
  });

  it('renders a review body containing "</script>" and "<" safely in the JSON-LD output', async () => {
    const dangerousBody = 'Nice <b>fabric</b> but not as described</script><script>alert(1)</script>';
    mockGetById.mockResolvedValue({
      data: { ...baseProduct, reviewSummary: { averageRating: 3, reviewCount: 1 } },
    });
    mockListApprovedForProduct.mockResolvedValue({
      items: [
        {
          id: 1,
          productId: 1,
          rating: 3,
          title: null,
          body: dangerousBody,
          authorNameSnapshot: 'Test User',
          createdAt: '2026-05-01T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 5,
      summary: { averageRating: 3, reviewCount: 1 },
      distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0 },
    });

    renderWithI18n(<ProductPage />, { lng: 'en' });
    const scripts = await waitFor(() => {
      const found = document.querySelectorAll('script[type="application/ld+json"]');
      expect(found.length).toBeGreaterThan(0);
      return found;
    });
    // the raw serialized script text must never contain a literal "</script>" sequence
    expect(scripts[0].textContent).not.toContain('</script>');
    // but JSON.parse must recover the exact original body (proves it's u003c-escaping,
    // not HTML-stripping or double-escaping)
    const parsed = JSON.parse(scripts[0].textContent ?? '{}');
    expect(parsed.review[0].reviewBody).toBe(dangerousBody);
  });
});

describe('ProductPage gallery color wiring', () => {
  const baseProduct = {
    id: 1,
    name: 'Dress',
    slug: 'dress',
    description: 'A dress',
    brand: null,
    status: 'Active',
    mainImageUrl: null,
    categoryId: null,
    reviewSummary: { averageRating: null, reviewCount: 0 },
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCategoryGetAll.mockResolvedValue([]);
    mockListApprovedForProduct.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 5,
      summary: { averageRating: null, reviewCount: 0 },
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });

  it('selecting a color-bearing variant changes only the main/hero gallery image', async () => {
    mockGetById.mockResolvedValue({
      data: {
        ...baseProduct,
        variants: [
          {
            id: 1,
            productId: 1,
            sku: 'SKU-RED',
            size: null,
            color: 'Red',
            publicPrice: 29.99,
            compareAtPrice: null,
            stockPolicy: 'SupplierManaged',
            status: 'Active',
            stockQuantity: 5,
            deletedAt: null,
            createdAt: '',
            updatedAt: '',
          },
          {
            id: 2,
            productId: 1,
            sku: 'SKU-BLUE',
            size: null,
            color: 'Blue',
            publicPrice: 29.99,
            compareAtPrice: null,
            stockPolicy: 'SupplierManaged',
            status: 'Active',
            stockQuantity: 5,
            deletedAt: null,
            createdAt: '',
            updatedAt: '',
          },
        ],
        images: [
          { id: 10, productId: 1, url: 'https://cdn/shared.jpg', altText: 'Shared', sortOrder: 0, color: null, createdAt: '' },
          { id: 11, productId: 1, url: 'https://cdn/red.jpg', altText: 'Red image', sortOrder: 1, color: 'Red', createdAt: '' },
          { id: 12, productId: 1, url: 'https://cdn/blue.jpg', altText: 'Blue image', sortOrder: 2, color: 'Blue', createdAt: '' },
        ],
      },
    });

    renderWithI18n(<ProductPage />, { lng: 'en' });

    await screen.findByRole('heading', { name: 'Dress' });
    // VariantSelector auto-selects the first color (Red) on mount, so the
    // main/hero image should already show Red's own photo — but the
    // thumbnail strip always shows every image regardless of selected color.
    await waitFor(() => {
      expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Red image');
    });
    expect(screen.getAllByAltText('Blue image').length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('Red image').length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('Shared').length).toBeGreaterThan(0);

    const blueButton = screen.getByRole('button', { name: /blue/i });
    fireEvent.click(blueButton);

    await waitFor(() => {
      expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Blue image');
    });
    // Thumbnail strip is unchanged — all three images remain present.
    expect(screen.getAllByAltText('Red image').length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('Blue image').length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('Shared').length).toBeGreaterThan(0);
  });

  it('a product without variants/colors renders the gallery unchanged', async () => {
    mockGetById.mockResolvedValue({
      data: {
        ...baseProduct,
        variants: [],
        images: [
          { id: 20, productId: 1, url: 'https://cdn/a.jpg', altText: 'Image A', sortOrder: 0, color: null, createdAt: '' },
          { id: 21, productId: 1, url: 'https://cdn/b.jpg', altText: 'Image B', sortOrder: 1, color: null, createdAt: '' },
        ],
      },
    });

    renderWithI18n(<ProductPage />, { lng: 'en' });

    await screen.findByRole('heading', { name: 'Dress' });
    const list = within(screen.getByRole('list'));
    expect(list.getAllByRole('listitem')).toHaveLength(2);
  });
});
