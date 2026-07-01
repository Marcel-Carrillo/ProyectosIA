import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Layout from '../Layout';
import ProductsPage from '../../pages/ProductsPage';
import { adminProductService } from '../../services/adminProductService';
import { categoryService } from '../../services/categoryService';

jest.mock('../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({ admin: { email: 'admin@mavile.es' }, logout: jest.fn() }),
}));
jest.mock('../../services/adminProductService');
jest.mock('../../services/categoryService');

beforeEach(() => {
  (adminProductService as jest.Mocked<typeof adminProductService>).list.mockResolvedValue({
    success: true, data: { items: [], total: 0, page: 1, pageSize: 20 }, message: '',
  });
  (categoryService as jest.Mocked<typeof categoryService>).getAll.mockResolvedValue([]);
});

describe('Admin Layout — noindex coverage', () => {
  it('renders noindex, nofollow on a representative admin page (ProductsPage)', async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/products']}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="products" element={<ProductsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    );
    await waitFor(() =>
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
    );
  });
});
