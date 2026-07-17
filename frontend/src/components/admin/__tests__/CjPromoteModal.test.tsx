import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CjPromoteModal from '../CjPromoteModal';
import { CjCatalogItem } from '../../../types/cjCatalog';
import { Category } from '../../../types/category';

const mockPromote = vi.fn();

vi.mock('../../../services/cjCatalogService', async () => ({
  cjCatalogService: {
    freightEstimate: vi.fn(),
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

describe('CjPromoteModal — default pricing formula', () => {
  beforeEach(() => {
    mockPromote.mockReset();
  });

  it('shows the flat 8€ shipping estimate without calling the live freight API', () => {
    renderModal();
    expect(screen.getByTestId('variant-shipping-estimate-1')).toHaveTextContent('8.00 €');
    expect(screen.getByTestId('pricing-formula-hint')).toBeInTheDocument();
  });

  it('pre-fills the public price as cost × 1.6 + 8€ (rounded to ,99)', () => {
    // 10 * 1.6 + 8 = 24 → 24.99
    renderModal();
    expect(screen.getByTestId('input-price-1')).toHaveValue(24.99);
  });

  it('pre-fills every selected item independently', () => {
    renderModal([item, item2]);
    expect(screen.getByTestId('input-price-1')).toHaveValue(24.99);
    expect(screen.getByTestId('input-price-2')).toHaveValue(24.99);
  });
});

describe('CjPromoteModal — category auto/override toggle', () => {
  beforeEach(() => {
    mockPromote.mockReset();
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
