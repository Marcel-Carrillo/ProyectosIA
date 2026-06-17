import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductsPage from '../ProductsPage';
import { Product } from '../../types/product';
import { adminProductService } from '../../services/adminProductService';
import { categoryService } from '../../services/categoryService';

jest.mock('../../services/adminProductService');
jest.mock('../../services/categoryService');

const mockedAdmin = adminProductService as jest.Mocked<typeof adminProductService>;
const mockedCategory = categoryService as jest.Mocked<typeof categoryService>;

const mockProduct: Product = {
  id: 7,
  name: 'Red Hoodie',
  slug: 'red-hoodie',
  description: null,
  brand: null,
  status: 'Active',
  mainImageUrl: null,
  categoryId: 4,
  createdAt: '',
  updatedAt: '',
};

const listResult = (items: Product[]) => ({
  success: true,
  data: { items, total: items.length, page: 1, pageSize: 20 },
  message: '',
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/products']}>
      <ProductsPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockedCategory.getAll.mockResolvedValue([]);
});

describe('ProductsPage', () => {
  it('renders products from the admin API', async () => {
    mockedAdmin.list.mockResolvedValue(listResult([mockProduct]));
    renderPage();
    expect(await screen.findByTestId('products-table')).toBeInTheDocument();
    expect(screen.getByTestId('product-row-7')).toBeInTheDocument();
    expect(screen.getByText('Red Hoodie')).toBeInTheDocument();
  });

  it('shows the empty state when there are no products', async () => {
    mockedAdmin.list.mockResolvedValue(listResult([]));
    renderPage();
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    mockedAdmin.list.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText(/unable to load products/i)).toBeInTheDocument();
  });

  it('always restricts and forwards filters: status filter triggers a re-query', async () => {
    mockedAdmin.list.mockResolvedValue(listResult([mockProduct]));
    renderPage();
    await screen.findByTestId('products-table');
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'Draft' } });
    await waitFor(() =>
      expect(mockedAdmin.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Draft', page: 1 })),
    );
  });

  it('opens and confirms the delete flow', async () => {
    mockedAdmin.list.mockResolvedValue(listResult([mockProduct]));
    mockedAdmin.remove.mockResolvedValue(undefined);
    renderPage();
    await screen.findByTestId('products-table');
    fireEvent.click(screen.getByTestId('btn-delete-7'));
    fireEvent.click(await screen.findByTestId('btn-confirm-delete'));
    await waitFor(() => expect(mockedAdmin.remove).toHaveBeenCalledWith(7));
  });
});
