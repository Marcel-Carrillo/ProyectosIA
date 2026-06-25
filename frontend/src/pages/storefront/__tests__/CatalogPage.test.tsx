import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import CatalogPage from '../CatalogPage';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { productService } from '../../../services/productService';

const mockSetSearchParams = jest.fn();

jest.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
}));

jest.mock('../../../services/productService', () => ({
  productService: {
    getAll: jest.fn(),
  },
}));

const mockedGetAll = productService.getAll as jest.Mock;

describe('CatalogPage language refetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAll.mockResolvedValue({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
    });
  });

  it('refetches products when language changes', async () => {
    const { i18n } = renderWithI18n(<CatalogPage />, { lng: 'en' });

    await waitFor(() => expect(mockedGetAll).toHaveBeenCalledTimes(1));

    await i18n.changeLanguage('es');

    await waitFor(() => expect(mockedGetAll).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });
});
