import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CjPromoteModal from '../CjPromoteModal';
import { CjCatalogItem } from '../../../types/cjCatalog';
import { Category } from '../../../types/category';

const mockFreightEstimate = vi.fn();
const mockPromote = vi.fn();

vi.mock('../../../services/cjCatalogService', async () => ({
  cjCatalogService: {
    freightEstimate: (...args: unknown[]) => mockFreightEstimate(...args),
    promote: (...args: unknown[]) => mockPromote(...args),
  },
  extractCjCatalogErrorMessage: (await vi.importActual('../../../services/cjCatalogService'))
    .extractCjCatalogErrorMessage,
}));

const item: CjCatalogItem = {
  id: 1,
  externalRef: 'vid-1',
  title: 'Black Dress',
  sku: 'CJ-vid-1',
  size: 'M',
  color: 'Black',
  supplierCost: '10.00',
  stockQuantity: 5,
  syncStatus: 'Synced',
  syncError: null,
  lastSyncedAt: null,
  promotionState: 'NotPromoted',
  productId: null,
  productVariantId: null,
};

const item2: CjCatalogItem = { ...item, id: 2, title: 'Blue Dress' };

const categories: Category[] = [
  { id: 1, name: 'Dresses', description: null, imageUrl: null, status: 'Active', parentId: null, createdAt: '', updatedAt: '' },
];

function renderModal(overrideItems: CjCatalogItem[] = [item]) {
  return render(
    <CjPromoteModal
      show
      onHide={vi.fn()}
      supplierId={3}
      items={overrideItems}
      categories={categories}
      onSuccess={vi.fn()}
    />
  );
}

describe('CjPromoteModal — automatic freight estimate', () => {
  beforeEach(() => {
    mockFreightEstimate.mockReset();
    mockPromote.mockReset();
  });

  it('fetches the shipping estimate for every item automatically on open, with no manual button', async () => {
    mockFreightEstimate.mockResolvedValue({
      success: true,
      data: { shippingCostEstimate: 3.42, suggestedPublicPrice: 13.99 },
      message: 'ok',
    });
    renderModal();

    await waitFor(() => expect(mockFreightEstimate).toHaveBeenCalledWith(3, 1));
    expect(screen.queryByText('Consultar envío')).not.toBeInTheDocument();
    expect(await screen.findByText('3.42 €')).toBeInTheDocument();
  });

  it('pre-fills the public price with the suggested price (cost + shipping + margin) automatically', async () => {
    mockFreightEstimate.mockResolvedValue({
      success: true,
      data: { shippingCostEstimate: 3.42, suggestedPublicPrice: 13.99 },
      message: 'ok',
    });
    renderModal();

    await waitFor(() => expect(screen.getByTestId('input-price-1')).toHaveValue(13.99));
  });

  it('fetches all selected items in parallel, one call per item', async () => {
    mockFreightEstimate.mockResolvedValue({
      success: true,
      data: { shippingCostEstimate: 1, suggestedPublicPrice: 11.99 },
      message: 'ok',
    });
    renderModal([item, item2]);

    await waitFor(() => expect(mockFreightEstimate).toHaveBeenCalledTimes(2));
    expect(mockFreightEstimate).toHaveBeenCalledWith(3, 1);
    expect(mockFreightEstimate).toHaveBeenCalledWith(3, 2);
  });

  it('shows an inline error per item and still allows manual price entry when the estimate call fails', async () => {
    mockFreightEstimate.mockRejectedValueOnce(new Error('network'));
    renderModal();

    expect(await screen.findByText('No se pudo consultar el envío.')).toBeInTheDocument();
    expect(screen.getByTestId('input-price-1')).not.toBeDisabled();
  });
});

describe('CjPromoteModal — category auto/override toggle', () => {
  beforeEach(() => {
    mockFreightEstimate.mockReset();
    mockPromote.mockReset();
    mockFreightEstimate.mockResolvedValue({
      success: true,
      data: { shippingCostEstimate: 1, suggestedPublicPrice: 11 },
      message: 'ok',
    });
  });

  it('defaults to automatic category mode: the override checkbox is unchecked and no category select is shown', async () => {
    renderModal();
    await screen.findByTestId('auto-category-hint');
    expect(screen.getByTestId('checkbox-override-category')).not.toBeChecked();
    expect(screen.queryByTestId('select-promote-category')).not.toBeInTheDocument();
  });

  it('submits without a categoryId when in automatic mode', async () => {
    mockPromote.mockResolvedValue({ data: {} });
    renderModal();
    await screen.findByTestId('auto-category-hint');

    fireEvent.click(screen.getByTestId('btn-modal-promote'));

    await waitFor(() => expect(mockPromote).toHaveBeenCalledTimes(1));
    const payload = mockPromote.mock.calls[0][1];
    expect(payload).not.toHaveProperty('categoryId');
  });

  it('reveals the category select when the override checkbox is checked, and sends the chosen categoryId', async () => {
    mockPromote.mockResolvedValue({ data: {} });
    renderModal();
    await screen.findByTestId('auto-category-hint');

    fireEvent.click(screen.getByTestId('checkbox-override-category'));
    expect(await screen.findByTestId('select-promote-category')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('select-promote-category'), { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('btn-modal-promote'));

    await waitFor(() =>
      expect(mockPromote).toHaveBeenCalledWith(3, expect.objectContaining({ categoryId: 1 }))
    );
  });

  it('shows a validation error and does not submit when override mode is on but no category is chosen', async () => {
    renderModal();
    await screen.findByTestId('auto-category-hint');

    fireEvent.click(screen.getByTestId('checkbox-override-category'));
    await screen.findByTestId('select-promote-category');
    fireEvent.click(screen.getByTestId('btn-modal-promote'));

    expect(await screen.findByText('Seleccione una categoría antes de promocionar.')).toBeInTheDocument();
    expect(mockPromote).not.toHaveBeenCalled();
  });

  it('resets to automatic mode and clears the chosen category when the modal is reopened', async () => {
    mockPromote.mockResolvedValue({ data: {} });
    const { rerender } = renderModal();
    await screen.findByTestId('auto-category-hint');
    fireEvent.click(screen.getByTestId('checkbox-override-category'));
    await screen.findByTestId('select-promote-category');

    rerender(
      <CjPromoteModal show={false} onHide={vi.fn()} supplierId={3} items={[item]} categories={categories} onSuccess={vi.fn()} />
    );
    rerender(
      <CjPromoteModal show onHide={vi.fn()} supplierId={3} items={[item]} categories={categories} onSuccess={vi.fn()} />
    );

    await screen.findByTestId('auto-category-hint');
    expect(screen.getByTestId('checkbox-override-category')).not.toBeChecked();
    expect(screen.queryByTestId('select-promote-category')).not.toBeInTheDocument();
  });
});
