import { vi, type Mocked } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import ProductFormModal from '../ProductFormModal';
import { Product } from '../../../types/product';
import { adminProductService } from '../../../services/adminProductService';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

vi.mock('../../../services/adminProductService', async () => {
  const actual = await vi.importActual('../../../services/adminProductService');
  return { __esModule: true, ...actual, adminProductService: { create: vi.fn() } };
});
const mocked = adminProductService as Mocked<typeof adminProductService>;

const renderModal = (ui: React.ReactElement) =>
  render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

const created: Product = {
  id: 9,
  name: 'New',
  slug: 'new',
  description: null,
  brand: null,
  gtin: null,
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

beforeEach(() => vi.clearAllMocks());

describe('ProductFormModal', () => {
  it('creates a product and calls onSuccess', async () => {
    mocked.create.mockResolvedValue({ success: true, data: created, message: '' });
    const onSuccess = vi.fn();
    renderModal(<ProductFormModal show onHide={vi.fn()} onSuccess={onSuccess} categories={[]} />);
    fireEvent.change(screen.getByTestId('input-product-name'), { target: { value: 'New' } });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'New' })),
    );
    expect(onSuccess).toHaveBeenCalledWith(created);
  });

  it('shows the slug-conflict error and keeps the modal open', async () => {
    mocked.create.mockRejectedValue(makeAxiosError('PRODUCT_SLUG_CONFLICT', 409));
    renderModal(<ProductFormModal show onHide={vi.fn()} onSuccess={vi.fn()} categories={[]} />);
    fireEvent.change(screen.getByTestId('input-product-name'), { target: { value: 'Dup' } });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });

  it('includes ES translation in create payload when provided', async () => {
    mocked.create.mockResolvedValue({ success: true, data: created, message: '' });
    renderModal(<ProductFormModal show onHide={vi.fn()} onSuccess={vi.fn()} categories={[]} />);
    fireEvent.change(screen.getByTestId('input-product-name'), { target: { value: 'Dress' } });
    fireEvent.change(screen.getByTestId('input-product-name-es'), { target: { value: 'Vestido' } });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith(expect.objectContaining({
        translations: expect.arrayContaining([
          expect.objectContaining({ locale: 'en', name: 'Dress' }),
          expect.objectContaining({ locale: 'es', name: 'Vestido' }),
        ]),
      })),
    );
  });

  it('includes gtin in the create payload when provided', async () => {
    mocked.create.mockResolvedValue({ success: true, data: created, message: '' });
    renderModal(<ProductFormModal show onHide={vi.fn()} onSuccess={vi.fn()} categories={[]} />);
    fireEvent.change(screen.getByTestId('input-product-name'), { target: { value: 'Dress' } });
    fireEvent.change(screen.getByTestId('input-product-gtin'), { target: { value: '4006381333931' } });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith(expect.objectContaining({ gtin: '4006381333931' })),
    );
  });

  it('submits null gtin when the field is left empty', async () => {
    mocked.create.mockResolvedValue({ success: true, data: created, message: '' });
    renderModal(<ProductFormModal show onHide={vi.fn()} onSuccess={vi.fn()} categories={[]} />);
    fireEvent.change(screen.getByTestId('input-product-name'), { target: { value: 'Dress' } });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith(expect.objectContaining({ gtin: null })),
    );
  });

  it('clears a previously entered gtin value before submitting', async () => {
    mocked.create.mockResolvedValue({ success: true, data: created, message: '' });
    renderModal(<ProductFormModal show onHide={vi.fn()} onSuccess={vi.fn()} categories={[]} />);
    fireEvent.change(screen.getByTestId('input-product-name'), { target: { value: 'Dress' } });
    fireEvent.change(screen.getByTestId('input-product-gtin'), { target: { value: '4006381333931' } });
    fireEvent.change(screen.getByTestId('input-product-gtin'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith(expect.objectContaining({ gtin: null })),
    );
  });
});
