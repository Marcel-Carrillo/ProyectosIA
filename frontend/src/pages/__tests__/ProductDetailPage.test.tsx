import { vi, type Mocked } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import ProductDetailPage from '../ProductDetailPage';
import { Product, ProductVariant } from '../../types/product';
import { adminProductService } from '../../services/adminProductService';
import { categoryService } from '../../services/categoryService';

vi.mock('../../services/adminProductService', async () => {
  const actual = await vi.importActual('../../services/adminProductService');
  return {
    __esModule: true,
    ...actual,
    adminProductService: {
      getById: vi.fn(),
      update: vi.fn(),
      listVariants: vi.fn(),
      listImages: vi.fn(),
    },
  };
});
vi.mock('../../services/categoryService');

const mockedAdmin = adminProductService as Mocked<typeof adminProductService>;
const mockedCategory = categoryService as Mocked<typeof categoryService>;

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
  gtin: null,
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
  stockPolicy: 'SupplierManaged',
  status,
  stockQuantity: 5,
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

beforeEach(() => vi.clearAllMocks());

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
    expect(await screen.findByText(/requiere al menos una variante activa/i)).toBeInTheDocument();
  });

  it('saves the general form via update and shows success', async () => {
    setup(makeProduct(), [variant('Active')]);
    await screen.findByTestId('general-section');
    mockedAdmin.update.mockResolvedValue({ success: true, data: makeProduct({ name: 'New' }), message: '' });
    fireEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(mockedAdmin.update).toHaveBeenCalled());
    expect(await screen.findByText(/guardado correctamente/i)).toBeInTheDocument();
  });

  it('shows the existing gtin value in the input', async () => {
    setup(makeProduct({ gtin: '5901234123457' }), [variant('Active')]);
    expect(await screen.findByTestId('input-gtin')).toHaveValue('5901234123457');
  });

  it('saves an edited gtin value', async () => {
    setup(makeProduct(), [variant('Active')]);
    await screen.findByTestId('general-section');
    mockedAdmin.update.mockResolvedValue({ success: true, data: makeProduct({ gtin: '4006381333931' }), message: '' });
    fireEvent.change(screen.getByTestId('input-gtin'), { target: { value: '4006381333931' } });
    fireEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() =>
      expect(mockedAdmin.update).toHaveBeenCalledWith(42, expect.objectContaining({ gtin: '4006381333931' })),
    );
  });

  it('clears an existing gtin value to null on save', async () => {
    setup(makeProduct({ gtin: '5901234123457' }), [variant('Active')]);
    await screen.findByTestId('input-gtin');
    mockedAdmin.update.mockResolvedValue({ success: true, data: makeProduct({ gtin: null }), message: '' });
    fireEvent.change(screen.getByTestId('input-gtin'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() =>
      expect(mockedAdmin.update).toHaveBeenCalledWith(42, expect.objectContaining({ gtin: null })),
    );
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
