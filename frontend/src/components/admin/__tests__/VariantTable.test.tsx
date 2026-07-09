import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import VariantTable from '../VariantTable';
import { ProductVariant } from '../../../types/product';
import { adminProductService } from '../../../services/adminProductService';

jest.mock('../../../services/adminProductService');
const mocked = adminProductService as jest.Mocked<typeof adminProductService>;

const variant: ProductVariant = {
  id: 5,
  productId: 1,
  sku: 'EJS-5',
  size: 'M',
  color: 'Red',
  publicPrice: 29.9,
  compareAtPrice: null,
  stockPolicy: 'SupplierManaged',
  status: 'Active',
  deletedAt: null,
  createdAt: '',
  updatedAt: '',
};

beforeEach(() => jest.clearAllMocks());

describe('VariantTable', () => {
  it('renders variant rows', () => {
    render(<VariantTable productId={1} variants={[variant]} onVariantsChange={jest.fn()} />);
    expect(screen.getByTestId('variant-card-5')).toBeInTheDocument();
    expect(within(screen.getByTestId('variant-card-5')).getByText('EJS-5')).toBeInTheDocument();
  });

  it('shows supplier cost and margin when the admin API provides them', () => {
    const sourced: ProductVariant = {
      ...variant,
      supplierId: 7,
      supplierReference: 'CJ-REF-1',
      supplierCost: 10,
      supplierName: 'CJ Dropshipping',
    };
    render(<VariantTable productId={1} variants={[sourced]} onVariantsChange={jest.fn()} />);
    // 29.90 public - 10.00 cost = 19.90 margin (67%)
    expect(screen.getByTestId('variant-supplier-cost-5').textContent).toContain('10');
    expect(screen.getByTestId('variant-margin-5').textContent).toContain('67');
  });

  it('renders a dash for supplier cost and margin when the variant has no supplier', () => {
    render(<VariantTable productId={1} variants={[variant]} onVariantsChange={jest.fn()} />);
    expect(screen.getByTestId('variant-supplier-cost-5').textContent).toBe('—');
    expect(screen.getByTestId('variant-margin-5').textContent).toBe('—');
  });

  it('shows the supplier cost read-only in the edit modal and warns on price below cost', async () => {
    const sourced: ProductVariant = {
      ...variant,
      supplierCost: 35,
      supplierName: 'CJ Dropshipping',
    };
    render(<VariantTable productId={1} variants={[sourced]} onVariantsChange={jest.fn()} />);
    fireEvent.click(within(screen.getByTestId('variant-card-5')).getByTestId('btn-edit-variant-5'));
    const costInput = await screen.findByTestId('input-variant-supplier-cost');
    expect(costInput).toBeDisabled();
    expect((costInput as HTMLInputElement).value).toContain('35');
    // publicPrice 29.90 <= supplierCost 35 → warning visible
    expect(screen.getByText(/public price is at or below the supplier cost/i)).toBeInTheDocument();
  });

  it('opens the add-variant modal', () => {
    render(<VariantTable productId={1} variants={[]} onVariantsChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('btn-add-variant'));
    expect(screen.getByTestId('modal-variant')).toBeInTheDocument();
    expect(screen.getByTestId('input-variant-sku')).toBeInTheDocument();
  });

  it('confirms delete and calls the service + onVariantsChange', async () => {
    mocked.deleteVariant.mockResolvedValue(undefined);
    const onVariantsChange = jest.fn();
    render(<VariantTable productId={1} variants={[variant]} onVariantsChange={onVariantsChange} />);
    fireEvent.click(within(screen.getByTestId('variant-card-5')).getByTestId('btn-delete-variant-5'));
    fireEvent.click(await screen.findByTestId('btn-confirm-delete-variant'));
    await waitFor(() => expect(mocked.deleteVariant).toHaveBeenCalledWith(1, 5));
    expect(onVariantsChange).toHaveBeenCalled();
  });
});
