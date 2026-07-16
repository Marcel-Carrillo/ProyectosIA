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

const categories: Category[] = [{ id: 1, name: 'Dresses' }];

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

describe('CjPromoteModal — freight estimate', () => {
  beforeEach(() => {
    mockFreightEstimate.mockReset();
    mockPromote.mockReset();
  });

  it('fetches and displays the shipping estimate and suggested price on click', async () => {
    mockFreightEstimate.mockResolvedValue({
      success: true,
      data: { shippingCostEstimate: 3.42, suggestedPublicPrice: 13.99 },
      message: 'ok',
    });
    renderModal();

    fireEvent.click(screen.getByTestId('btn-estimate-freight-1'));

    await waitFor(() => expect(mockFreightEstimate).toHaveBeenCalledWith(3, 1));
    expect(await screen.findByText('3.42 €')).toBeInTheDocument();
    expect(screen.getByTestId('btn-use-suggested-price-1')).toHaveTextContent('13.99');
  });

  it('fills the public price input with the suggested price on "Usar precio sugerido"', async () => {
    mockFreightEstimate.mockResolvedValue({
      success: true,
      data: { shippingCostEstimate: 3.42, suggestedPublicPrice: 13.99 },
      message: 'ok',
    });
    renderModal();

    fireEvent.click(screen.getByTestId('btn-estimate-freight-1'));
    await screen.findByTestId('btn-use-suggested-price-1');
    fireEvent.click(screen.getByTestId('btn-use-suggested-price-1'));

    expect(screen.getByTestId('input-price-1')).toHaveValue(13.99);
  });

  it('shows an inline error and lets the admin retry when the estimate call fails', async () => {
    mockFreightEstimate.mockRejectedValueOnce(new Error('network'));
    renderModal();

    fireEvent.click(screen.getByTestId('btn-estimate-freight-1'));
    expect(await screen.findByText('No se pudo consultar el envío.')).toBeInTheDocument();
    expect(screen.getByTestId('btn-estimate-freight-1')).toBeInTheDocument();
  });
});
