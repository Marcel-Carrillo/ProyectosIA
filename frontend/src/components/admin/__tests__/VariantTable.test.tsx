import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VariantTable from '../VariantTable';
import { ProductVariant } from '../../../types/product';

jest.mock('../../../services/adminProductService');
import { adminProductService } from '../../../services/adminProductService';
const mocked = adminProductService as jest.Mocked<typeof adminProductService>;

const variant: ProductVariant = {
  id: 5,
  productId: 1,
  sku: 'EJS-5',
  size: 'M',
  color: 'Red',
  publicPrice: 29.9,
  compareAtPrice: null,
  stockPolicy: 'TRACK',
  status: 'Active',
  deletedAt: null,
  createdAt: '',
  updatedAt: '',
};

beforeEach(() => jest.clearAllMocks());

describe('VariantTable', () => {
  it('renders variant rows and never exposes supplier fields', () => {
    const { container } = render(
      <VariantTable productId={1} variants={[variant]} onVariantsChange={jest.fn()} />,
    );
    expect(screen.getByTestId('variant-row-5')).toBeInTheDocument();
    expect(screen.getByText('EJS-5')).toBeInTheDocument();
    const html = container.innerHTML;
    expect(html).not.toMatch(/supplierId|supplierReference|supplierCost/i);
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
    fireEvent.click(screen.getByTestId('btn-delete-variant-5'));
    fireEvent.click(await screen.findByTestId('btn-confirm-delete-variant'));
    await waitFor(() => expect(mocked.deleteVariant).toHaveBeenCalledWith(1, 5));
    expect(onVariantsChange).toHaveBeenCalled();
  });
});
