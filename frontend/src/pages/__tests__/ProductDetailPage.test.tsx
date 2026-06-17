import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import ProductDetailPage from '../ProductDetailPage';
import { Product, ProductVariant } from '../../types/product';

jest.mock('../../services/adminProductService', () => {
  const actual = jest.requireActual('../../services/adminProductService');
  return {
    __esModule: true,
    ...actual,
    adminProductService: {
      getById: jest.fn(),
      update: jest.fn(),
      listVariants: jest.fn(),
      listImages: jest.fn(),
    },
  };
});
jest.mock('../../services/categoryService');
import { adminProductService } from '../../services/adminProductService';
import { categoryService } from '../../services/categoryService';

const mockedAdmin = adminProductService as jest.Mocked<typeof adminProductService>;
const mockedCategory = categoryService as jest.Mocked<typeof categoryService>;

const makeAxiosError = (code: string, status: number) => {
  const err = new axios.AxiosError('error');
  err.response = { data: { success: false, error: { code, message: 'x' } }, status, statusText: '', headers: {}, config: {} as never };
  return err;
};

const makeProduct = (over: Partial<Product> = {}): Product => ({
  id: 42,
  name: 'Sample',
  slug: 'sample',
  description: null,
  brand: null,
  status: 'Draft',
  mainImageUrl: null,
  categoryId: null,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const variant = (status: 'Active' | 'Inactive'): ProductVariant => ({
  id: 1,
  productId: 42,
  sku: 'SKU-1',
  size: null,
  color: null,
  publicPrice: 10,
  compareAtPrice: null,
  stockPolicy: 'TRACK',
  status,
  deletedAt: null,
  createdAt: '',
  updatedAt: '',
});

const setup = (product: Product, variants: ProductVariant[]) => {
  mockedAdmin.getById.mockResolvedValue({ success: true, data: product, message: '' });
  mockedAdmin.listVariants.mockResolvedValue({ success: true, data: variants, message: '' });
  mockedAdmin.listImages.mockResolvedValue({ success: true, data: [], message: '' });
  mockedCategory.getAll.mockResolvedValue([]);
  return render(
    <MemoryRouter initialEntries={['/products/42']}>
      <Routes>
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/products" element={<div>products list</div>} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => jest.clearAllMocks());

describe('ProductDetailPage', () => {
  it('loads and renders product sections', async () => {
    setup(makeProduct(), [variant('Active')]);
    expect(await screen.findByTestId('general-section')).toBeInTheDocument();
    expect(screen.getByTestId('variants-section')).toBeInTheDocument();
    expect(screen.getByTestId('images-section')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sample' })).toBeInTheDocument();
  });

  it('disables Activate when there is no active variant', async () => {
    setup(makeProduct({ status: 'Draft' }), [variant('Inactive')]);
    expect(await screen.findByTestId('btn-activate')).toBeDisabled();
  });

  it('enables Activate when at least one active variant exists', async () => {
    setup(makeProduct({ status: 'Draft' }), [variant('Active')]);
    expect(await screen.findByTestId('btn-activate')).toBeEnabled();
  });

  it('surfaces the 422 PRODUCT_REQUIRES_ACTIVE_VARIANT error from the server', async () => {
    setup(makeProduct({ status: 'Draft' }), [variant('Active')]);
    mockedAdmin.update.mockRejectedValue(makeAxiosError('PRODUCT_REQUIRES_ACTIVE_VARIANT', 422));
    fireEvent.click(await screen.findByTestId('btn-activate'));
    expect(await screen.findByText(/requires at least one active variant/i)).toBeInTheDocument();
  });

  it('saves the general form via update and shows success', async () => {
    setup(makeProduct(), [variant('Active')]);
    await screen.findByTestId('general-section');
    mockedAdmin.update.mockResolvedValue({ success: true, data: makeProduct({ name: 'New' }), message: '' });
    fireEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(mockedAdmin.update).toHaveBeenCalled());
    expect(await screen.findByText(/saved successfully/i)).toBeInTheDocument();
  });

  it('redirects to the list when the product is not found', async () => {
    mockedAdmin.getById.mockRejectedValue(makeAxiosError('PRODUCT_NOT_FOUND', 404));
    mockedAdmin.listVariants.mockResolvedValue({ success: true, data: [], message: '' });
    mockedAdmin.listImages.mockResolvedValue({ success: true, data: [], message: '' });
    mockedCategory.getAll.mockResolvedValue([]);
    render(
      <MemoryRouter initialEntries={['/products/42']}>
        <Routes>
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/products" element={<div>products list</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('products list')).toBeInTheDocument();
  });
});
