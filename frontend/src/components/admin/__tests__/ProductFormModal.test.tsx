import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import ProductFormModal from '../ProductFormModal';
import { Product } from '../../../types/product';
import { adminProductService } from '../../../services/adminProductService';

jest.mock('../../../services/adminProductService', () => {
  const actual = jest.requireActual('../../../services/adminProductService');
  return { __esModule: true, ...actual, adminProductService: { create: jest.fn() } };
});
const mocked = adminProductService as jest.Mocked<typeof adminProductService>;

const created: Product = {
  id: 9,
  name: 'New',
  slug: 'new',
  description: null,
  brand: null,
  status: 'Draft',
  mainImageUrl: null,
  categoryId: null,
  createdAt: '',
  updatedAt: '',
};

const makeAxiosError = (code: string, status: number) => {
  const err = new axios.AxiosError('error');
  err.response = { data: { success: false, error: { code, message: 'x' } }, status, statusText: '', headers: {}, config: {} as never };
  return err;
};

beforeEach(() => jest.clearAllMocks());

describe('ProductFormModal', () => {
  it('creates a product and calls onSuccess', async () => {
    mocked.create.mockResolvedValue({ success: true, data: created, message: '' });
    const onSuccess = jest.fn();
    render(<ProductFormModal show onHide={jest.fn()} onSuccess={onSuccess} categories={[]} />);
    fireEvent.change(screen.getByTestId('input-product-name'), { target: { value: 'New' } });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'New' })),
    );
    expect(onSuccess).toHaveBeenCalledWith(created);
  });

  it('shows the slug-conflict error and keeps the modal open', async () => {
    mocked.create.mockRejectedValue(makeAxiosError('PRODUCT_SLUG_CONFLICT', 409));
    render(<ProductFormModal show onHide={jest.fn()} onSuccess={jest.fn()} categories={[]} />);
    fireEvent.change(screen.getByTestId('input-product-name'), { target: { value: 'Dup' } });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });
});
