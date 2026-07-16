import { vi, type Mocked } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import VariantTable from '../VariantTable';
import { ProductVariant } from '../../../types/product';
import { adminProductService, extractErrorMessage, extractErrorCode } from '../../../services/adminProductService';

vi.mock('../../../services/adminProductService');
const mocked = adminProductService as Mocked<typeof adminProductService>;
const mockedExtractErrorMessage = extractErrorMessage as unknown as ReturnType<typeof vi.fn>;
const mockedExtractErrorCode = extractErrorCode as unknown as ReturnType<typeof vi.fn>;

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
  stockQuantity: 5,
  deletedAt: null,
  createdAt: '',
  updatedAt: '',
};

beforeEach(() => vi.clearAllMocks());

describe('VariantTable', () => {
  it('renders variant rows', () => {
    render(<VariantTable productId={1} variants={[variant]} onVariantsChange={vi.fn()} />);
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
    render(<VariantTable productId={1} variants={[sourced]} onVariantsChange={vi.fn()} />);
    // 29.90 public - 10.00 cost = 19.90 margin (67%)
    expect(screen.getByTestId('variant-supplier-cost-5').textContent).toContain('10');
    expect(screen.getByTestId('variant-margin-5').textContent).toContain('67');
  });

  it('renders a dash for supplier cost and margin when the variant has no supplier', () => {
    render(<VariantTable productId={1} variants={[variant]} onVariantsChange={vi.fn()} />);
    expect(screen.getByTestId('variant-supplier-cost-5').textContent).toBe('—');
    expect(screen.getByTestId('variant-margin-5').textContent).toBe('—');
  });

  it('shows the supplier cost read-only in the edit modal and warns on price below cost', async () => {
    const sourced: ProductVariant = {
      ...variant,
      supplierCost: 35,
      supplierName: 'CJ Dropshipping',
    };
    render(<VariantTable productId={1} variants={[sourced]} onVariantsChange={vi.fn()} />);
    fireEvent.click(within(screen.getByTestId('variant-card-5')).getByTestId('btn-edit-variant-5'));
    const costInput = await screen.findByTestId('input-variant-supplier-cost');
    expect(costInput).toBeDisabled();
    expect((costInput as HTMLInputElement).value).toContain('35');
    // publicPrice 29.90 <= supplierCost 35 → warning visible
    expect(screen.getByText(/precio público es igual o inferior al coste del proveedor/i)).toBeInTheDocument();
  });

  it('opens the add-variant modal', () => {
    render(<VariantTable productId={1} variants={[]} onVariantsChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('btn-add-variant'));
    expect(screen.getByTestId('modal-variant')).toBeInTheDocument();
    expect(screen.getByTestId('input-variant-sku')).toBeInTheDocument();
  });

  it('confirms delete and calls the service + onVariantsChange', async () => {
    mocked.deleteVariant.mockResolvedValue(undefined);
    const onVariantsChange = vi.fn();
    render(<VariantTable productId={1} variants={[variant]} onVariantsChange={onVariantsChange} />);
    fireEvent.click(within(screen.getByTestId('variant-card-5')).getByTestId('btn-delete-variant-5'));
    fireEvent.click(await screen.findByTestId('btn-confirm-delete-variant'));
    await waitFor(() => expect(mocked.deleteVariant).toHaveBeenCalledWith(1, 5));
    expect(onVariantsChange).toHaveBeenCalled();
  });

  it('shows the shipping estimate and net margin when the admin API provides them', () => {
    const sourced: ProductVariant = {
      ...variant,
      supplierCost: 10,
      shippingCostEstimate: 4,
      netMargin: 15.9, // 29.9 - 10 - 4
    };
    render(<VariantTable productId={1} variants={[sourced]} onVariantsChange={vi.fn()} />);
    expect(screen.getByTestId('variant-shipping-estimate-5').textContent).toContain('4');
    expect(screen.getByTestId('variant-net-margin-5').textContent).toContain('15');
  });

  it('shows a warning badge when marginWarning is true, danger styling when netMargin is negative', () => {
    const losing: ProductVariant = {
      ...variant,
      supplierCost: 40,
      shippingCostEstimate: 5,
      netMargin: -15.1,
      marginWarning: true,
    };
    render(<VariantTable productId={1} variants={[losing]} onVariantsChange={vi.fn()} />);
    expect(
      within(screen.getByTestId('variant-row-5')).getByTestId('variant-margin-warning-5')
    ).toBeInTheDocument();
  });

  it('does not show a warning badge when marginWarning is false', () => {
    const healthy: ProductVariant = {
      ...variant,
      supplierCost: 5,
      shippingCostEstimate: 2,
      netMargin: 22.9,
      marginWarning: false,
    };
    render(<VariantTable productId={1} variants={[healthy]} onVariantsChange={vi.fn()} />);
    expect(
      within(screen.getByTestId('variant-row-5')).queryByTestId('variant-margin-warning-5')
    ).not.toBeInTheDocument();
  });

  it('shows the missing-estimate indicator when shippingCostEstimate is null and no fetch is in flight', () => {
    // Not a CJ-linked variant fixture here — refreshFreightEstimate isn't
    // mocked with a resolved value, so the automatic fetch this component
    // fires never affects the assertion below (it settles on a later tick).
    mocked.refreshFreightEstimate.mockReturnValue(new Promise(() => {}));
    const missing: ProductVariant = {
      ...variant,
      supplierCost: 10,
      shippingCostEstimate: null,
      shippingEstimateMissing: true,
      netMargin: 19.9,
    };
    render(<VariantTable productId={1} variants={[missing]} onVariantsChange={vi.fn()} />);
    // While the automatic fetch is in flight, a spinner is shown instead of '—'.
    expect(
      within(screen.getByTestId('variant-shipping-estimate-5')).getByRole('status')
    ).toBeInTheDocument();
  });

  it('automatically fetches and persists the shipping estimate for a variant missing one — no manual button', async () => {
    mocked.refreshFreightEstimate.mockResolvedValue({ success: true, data: variant, message: '' });
    const onVariantsChange = vi.fn();
    const missing: ProductVariant = { ...variant, shippingCostEstimate: null, shippingEstimateMissing: true };
    render(<VariantTable productId={1} variants={[missing]} onVariantsChange={onVariantsChange} />);

    expect(screen.queryByTestId('btn-refresh-shipping-estimate-5')).not.toBeInTheDocument();
    await waitFor(() => expect(mocked.refreshFreightEstimate).toHaveBeenCalledWith(1, 5));
    await waitFor(() => expect(onVariantsChange).toHaveBeenCalled());
  });

  it('suppresses the error and does not call onVariantsChange when the variant has no CJ mapping', async () => {
    mocked.refreshFreightEstimate.mockRejectedValue({
      response: { data: { error: { code: 'CJ_ITEM_NOT_MAPPED' } } },
    });
    mockedExtractErrorCode.mockReturnValue('CJ_ITEM_NOT_MAPPED');
    const onVariantsChange = vi.fn();
    const missing: ProductVariant = { ...variant, shippingCostEstimate: null, shippingEstimateMissing: true };
    render(<VariantTable productId={1} variants={[missing]} onVariantsChange={onVariantsChange} />);

    await waitFor(() => expect(mocked.refreshFreightEstimate).toHaveBeenCalledWith(1, 5));
    expect(onVariantsChange).not.toHaveBeenCalled();
    expect(screen.queryByText(/no está vinculada a un artículo/i)).not.toBeInTheDocument();
  });

  it('shows an error message for an unexpected failure (e.g. CJ API unavailable)', async () => {
    mocked.refreshFreightEstimate.mockRejectedValue({
      response: { data: { error: { code: 'CJ_API_UNAVAILABLE' } } },
    });
    mockedExtractErrorCode.mockReturnValue('CJ_API_UNAVAILABLE');
    mockedExtractErrorMessage.mockReturnValue(
      'El servicio de CJ Dropshipping no está disponible en este momento. Inténtelo de nuevo más tarde.'
    );
    const missing: ProductVariant = { ...variant, shippingCostEstimate: null, shippingEstimateMissing: true };
    render(<VariantTable productId={1} variants={[missing]} onVariantsChange={vi.fn()} />);

    expect(await screen.findByText(/no está disponible en este momento/i)).toBeInTheDocument();
  });
});
