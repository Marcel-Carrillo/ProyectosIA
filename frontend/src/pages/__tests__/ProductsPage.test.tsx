import { vi, type Mocked } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductsPage from '../ProductsPage';
import { Product } from '../../types/product';
import { adminProductService } from '../../services/adminProductService';
import { categoryService } from '../../services/categoryService';

vi.mock('../../services/adminProductService');
vi.mock('../../services/categoryService');

const mockedAdmin = adminProductService as Mocked<typeof adminProductService>;
const mockedCategory = categoryService as Mocked<typeof categoryService>;

const mockProduct: Product = {
  id: 7,
  name: 'Red Hoodie',
  slug: 'red-hoodie',
  description: null,
  brand: null,
  gtin: null,
  status: 'Active',
  mainImageUrl: 'https://cdn.example.com/hoodie.jpg',
  categoryId: 4,
  createdAt: '',
  updatedAt: '',
  variants: [
    {
      id: 1,
      productId: 7,
      sku: 'RH-S',
      size: 'S',
      color: 'Red',
      publicPrice: 29.99,
      compareAtPrice: null,
      stockPolicy: 'SupplierManaged',
      status: 'Active',
      stockQuantity: 10,
      supplierCost: 8.5,
      deletedAt: null,
      createdAt: '',
      updatedAt: '',
    },
  ],
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
  vi.clearAllMocks();
  mockedCategory.getAllAdmin.mockResolvedValue([]);
});

describe('ProductsPage', () => {
  it('renders product cards with supplier cost, status and actions (no name/slug)', async () => {
    mockedAdmin.list.mockResolvedValue(listResult([mockProduct]));
    renderPage();
    expect(await screen.findByTestId('products-card-list')).toBeInTheDocument();
    const card = screen.getByTestId('product-card-row-7');
    expect(card).toBeInTheDocument();
    expect(within(card).getByTestId('product-supplier-cost-7')).toHaveTextContent('8,50');
    expect(within(card).getByText('Activo')).toBeInTheDocument();
    expect(within(card).getByTestId('btn-edit-7')).toHaveTextContent('Ver');
    expect(within(card).getByTestId('btn-delete-7')).toBeInTheDocument();
    expect(within(card).queryByText('Red Hoodie')).not.toBeInTheDocument();
    expect(within(card).queryByText('red-hoodie')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no products', async () => {
    mockedAdmin.list.mockResolvedValue(listResult([]));
    renderPage();
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    mockedAdmin.list.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText(/no se pudieron cargar los productos/i)).toBeInTheDocument();
  });

  it('always restricts and forwards filters: status filter triggers a re-query', async () => {
    mockedAdmin.list.mockResolvedValue(listResult([mockProduct]));
    renderPage();
    await screen.findByTestId('products-card-list');
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'Draft' } });
    await waitFor(() =>
      expect(mockedAdmin.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Draft', page: 1 })),
    );
  });

  it('opens and confirms the delete flow', async () => {
    mockedAdmin.list.mockResolvedValue(listResult([mockProduct]));
    mockedAdmin.remove.mockResolvedValue(undefined);
    renderPage();
    await screen.findByTestId('products-card-list');
    fireEvent.click(within(screen.getByTestId('product-card-row-7')).getByTestId('btn-delete-7'));
    fireEvent.click(await screen.findByTestId('btn-confirm-delete'));
    await waitFor(() => expect(mockedAdmin.remove).toHaveBeenCalledWith(7));
  });
});
