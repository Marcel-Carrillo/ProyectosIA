import React from 'react';
import { waitFor } from '@testing-library/react';
import ProductPage from '../ProductPage';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';

const mockGetById = jest.fn();

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

describe('ProductPage language refetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetById.mockResolvedValue({
      data: {
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
