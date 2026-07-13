import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CjCatalogPage from '../CjCatalogPage';

const mockListCatalog = vi.fn();
const mockPromote = vi.fn();
const mockActivate = vi.fn();
const mockDeactivate = vi.fn();
const mockGetAllCategories = vi.fn();

const mockGetConnection = vi.fn();
const mockConfigureConnection = vi.fn();
const mockVerifyConnection = vi.fn();
const mockSync = vi.fn();

vi.mock('../../services/cjCatalogService', async () => ({
  cjCatalogService: {
    listCatalog: (...args: unknown[]) => mockListCatalog(...args),
    promote: (...args: unknown[]) => mockPromote(...args),
    activate: (...args: unknown[]) => mockActivate(...args),
    deactivate: (...args: unknown[]) => mockDeactivate(...args),
  },
  extractCjCatalogErrorMessage: (await vi.importActual('../../services/cjCatalogService')).extractCjCatalogErrorMessage,
  mapCjCatalogError: (await vi.importActual('../../services/cjCatalogService')).mapCjCatalogError,
}));

vi.mock('../../services/cjConnectionService', async () => ({
  cjConnectionService: {
    getConnection: (...args: unknown[]) => mockGetConnection(...args),
    configureConnection: (...args: unknown[]) => mockConfigureConnection(...args),
    verifyConnection: (...args: unknown[]) => mockVerifyConnection(...args),
    sync: (...args: unknown[]) => mockSync(...args),
  },
  extractCjConnectionErrorMessage: (await vi.importActual('../../services/cjConnectionService'))
    .extractCjConnectionErrorMessage,
  extractCjConnectionErrorCode: (await vi.importActual('../../services/cjConnectionService')).extractCjConnectionErrorCode,
  mapCjConnectionError: (await vi.importActual('../../services/cjConnectionService')).mapCjConnectionError,
}));

vi.mock('../../services/categoryService', () => ({
  categoryService: {
    getAll: (...args: unknown[]) => mockGetAllCategories(...args),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/suppliers/3/cj-catalog']}>
      <Routes>
        <Route path="/suppliers/:supplierId/cj-catalog" element={<CjCatalogPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const baseConnection = {
  id: 1,
  supplierId: 3,
  provider: 'CJDropshipping',
  status: 'Connected' as const,
  externalAccountRef: null,
  lastVerifiedAt: null,
  lastSyncedAt: null,
  createdAt: '',
  updatedAt: '',
};

const notPromotedItem = {
  id: 1,
  externalRef: 'vid-1',
  title: 'Black Dress',
  sku: 'CJ-vid-1',
  size: 'M',
  color: 'Black',
  supplierCost: '10.00',
  stockQuantity: 5,
  syncStatus: 'Synced' as const,
  syncError: null,
  lastSyncedAt: '2026-01-01T00:00:00.000Z',
  promotionState: 'NotPromoted' as const,
  productId: null,
  productVariantId: null,
};

const activeItem = {
  ...notPromotedItem,
  id: 2,
  externalRef: 'vid-2',
  title: 'Red Dress',
  promotionState: 'Active' as const,
  productId: 20,
  productVariantId: 50,
};

const inactiveItem = {
  ...notPromotedItem,
  id: 3,
  externalRef: 'vid-3',
  title: 'Blue Dress',
  promotionState: 'Inactive' as const,
  productId: 21,
  productVariantId: 51,
};

const failedItem = {
  ...notPromotedItem,
  id: 4,
  externalRef: 'vid-4',
  title: 'Broken Item',
  syncStatus: 'Failed' as const,
};

describe('CjCatalogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllCategories.mockResolvedValue([
      { id: 1, name: 'Dresses', description: null, imageUrl: null, status: 'Active', parentId: null, createdAt: '', updatedAt: '' },
    ]);
    mockGetConnection.mockResolvedValue({ data: baseConnection });
  });

  it('shows a loading state while fetching', async () => {
    mockListCatalog.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(await screen.findByTestId('loading-state')).toBeInTheDocument();
  });

  it('renders a NotPromoted item with an enabled checkbox and no product link', async () => {
    mockListCatalog.mockResolvedValue({ data: { items: [notPromotedItem], total: 1, page: 1, pageSize: 20 } });
    renderPage();

    const card = await screen.findByTestId('cj-catalog-card-row-1');
    expect(within(card).getByText('Black Dress')).toBeInTheDocument();
    expect(within(card).getByTestId('promotion-badge-1')).toHaveTextContent('Sin promocionar');
    const checkbox = within(card).getByTestId('checkbox-select-1') as HTMLInputElement;
    expect(checkbox.disabled).toBe(false);
  });

  it('renders Active and Inactive items with product links and the correct action button', async () => {
    mockListCatalog.mockResolvedValue({
      data: { items: [activeItem, inactiveItem], total: 2, page: 1, pageSize: 20 },
    });
    renderPage();

    const activeCard = await screen.findByTestId('cj-catalog-card-row-2');
    expect(within(activeCard).getByTestId('promotion-badge-2')).toHaveTextContent('Activo');
    expect(within(activeCard).getByTestId('btn-deactivate-2')).toBeInTheDocument();
    expect(within(activeCard).queryByTestId('btn-activate-2')).not.toBeInTheDocument();

    const inactiveCard = screen.getByTestId('cj-catalog-card-row-3');
    expect(within(inactiveCard).getByTestId('promotion-badge-3')).toHaveTextContent('Inactivo');
    expect(within(inactiveCard).getByTestId('btn-activate-3')).toBeInTheDocument();
    expect(within(inactiveCard).queryByTestId('btn-deactivate-3')).not.toBeInTheDocument();

    const productLinks = screen.getAllByRole('link', { name: '20' });
    expect(productLinks[0]).toHaveAttribute('href', '/products/20');
  });

  it('disables the checkbox for items that failed sync', async () => {
    mockListCatalog.mockResolvedValue({ data: { items: [failedItem], total: 1, page: 1, pageSize: 20 } });
    renderPage();

    const card = await screen.findByTestId('cj-catalog-card-row-4');
    const checkbox = within(card).getByTestId('checkbox-select-4') as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
  });

  it('shows the empty state when there are no items', async () => {
    mockListCatalog.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } });
    renderPage();

    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows an error message when the list fetch fails for a supplier with a connection', async () => {
    mockListCatalog.mockRejectedValue({ response: { data: { error: { code: 'CJ_CONNECTION_NOT_FOUND' } } } });
    renderPage();

    expect(await screen.findByText(/No hay una conexión con CJ Dropshipping/i)).toBeInTheDocument();
  });

  it('refetches with the sync status filter applied', async () => {
    mockListCatalog.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } });
    renderPage();
    await screen.findByTestId('empty-state');

    fireEvent.change(screen.getByTestId('filter-sync-status'), { target: { value: 'Failed' } });

    await waitFor(() =>
      expect(mockListCatalog).toHaveBeenLastCalledWith(3, expect.objectContaining({ syncStatus: 'Failed', page: 1 }))
    );
  });

  it('shows and updates the bulk-action bar on selection, and clears it on select-all toggle', async () => {
    mockListCatalog.mockResolvedValue({ data: { items: [notPromotedItem], total: 1, page: 1, pageSize: 20 } });
    renderPage();
    const card = await screen.findByTestId('cj-catalog-card-row-1');

    fireEvent.click(within(card).getByTestId('checkbox-select-1'));
    expect(await screen.findByTestId('bulk-action-bar')).toHaveTextContent('1 seleccionados');

    fireEvent.click(screen.getByTestId('checkbox-select-all'));
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
  });

  it('clears the selection after a successful refetch', async () => {
    mockListCatalog.mockResolvedValue({ data: { items: [notPromotedItem], total: 1, page: 1, pageSize: 20 } });
    renderPage();
    const card = await screen.findByTestId('cj-catalog-card-row-1');

    fireEvent.click(within(card).getByTestId('checkbox-select-1'));
    await screen.findByTestId('bulk-action-bar');

    fireEvent.change(screen.getByTestId('filter-sync-status'), { target: { value: 'Failed' } });

    await waitFor(() => expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument());
  });

  it('opens the promote modal with only the selected items', async () => {
    mockListCatalog.mockResolvedValue({
      data: { items: [notPromotedItem, { ...notPromotedItem, id: 5, title: 'Green Dress' }], total: 2, page: 1, pageSize: 20 },
    });
    renderPage();
    const card = await screen.findByTestId('cj-catalog-card-row-1');

    fireEvent.click(within(card).getByTestId('checkbox-select-1'));
    fireEvent.click(await screen.findByTestId('btn-promote-selected'));

    const modal = await screen.findByTestId('modal-promote-cj');
    expect(within(modal).getByTestId('promote-items-table')).toHaveTextContent('Black Dress');
    expect(within(modal).getByTestId('promote-items-table')).not.toHaveTextContent('Green Dress');
  });

  it('promotes successfully, closes the modal, and refetches the list', async () => {
    mockListCatalog.mockResolvedValue({ data: { items: [notPromotedItem], total: 1, page: 1, pageSize: 20 } });
    mockPromote.mockResolvedValue({ data: {} });
    renderPage();
    const card = await screen.findByTestId('cj-catalog-card-row-1');

    fireEvent.click(within(card).getByTestId('checkbox-select-1'));
    fireEvent.click(await screen.findByTestId('btn-promote-selected'));
    const modal = await screen.findByTestId('modal-promote-cj');

    fireEvent.change(within(modal).getByTestId('select-promote-category'), { target: { value: '1' } });
    fireEvent.click(within(modal).getByTestId('btn-modal-promote'));

    await waitFor(() =>
      expect(mockPromote).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ categoryId: 1, items: [{ cjCatalogItemId: 1, publicPrice: undefined, compareAtPrice: undefined }] })
      )
    );
    await waitFor(() => expect(screen.queryByTestId('modal-promote-cj')).not.toBeInTheDocument());
    expect(mockListCatalog).toHaveBeenCalledTimes(2);
  });

  it('shows a mapped error and keeps the modal open when promote fails', async () => {
    mockListCatalog.mockResolvedValue({ data: { items: [notPromotedItem], total: 1, page: 1, pageSize: 20 } });
    renderPage();
    const card = await screen.findByTestId('cj-catalog-card-row-1');

    fireEvent.click(within(card).getByTestId('checkbox-select-1'));
    fireEvent.click(await screen.findByTestId('btn-promote-selected'));
    const modal = await screen.findByTestId('modal-promote-cj');

    fireEvent.click(within(modal).getByTestId('btn-modal-promote'));

    expect(
      await within(modal).findByText(/Seleccione una categoría antes de promocionar/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('modal-promote-cj')).toBeInTheDocument();
    expect(mockPromote).not.toHaveBeenCalled();
    expect(mockListCatalog).toHaveBeenCalledTimes(1);
  });

  it('activates an Inactive item and refetches', async () => {
    mockListCatalog.mockResolvedValue({ data: { items: [inactiveItem], total: 1, page: 1, pageSize: 20 } });
    mockActivate.mockResolvedValue({ data: { productId: 21, productVariantId: 51 } });
    renderPage();
    const card = await screen.findByTestId('cj-catalog-card-row-3');

    fireEvent.click(within(card).getByTestId('btn-activate-3'));

    await waitFor(() => expect(mockActivate).toHaveBeenCalledWith(3, 3));
    await waitFor(() => expect(mockListCatalog).toHaveBeenCalledTimes(2));
  });

  it('deactivates an Active item and refetches', async () => {
    mockListCatalog.mockResolvedValue({ data: { items: [activeItem], total: 1, page: 1, pageSize: 20 } });
    mockDeactivate.mockResolvedValue({ data: { productId: 20, productVariantId: 50 } });
    renderPage();
    const card = await screen.findByTestId('cj-catalog-card-row-2');

    fireEvent.click(within(card).getByTestId('btn-deactivate-2'));

    await waitFor(() => expect(mockDeactivate).toHaveBeenCalledWith(3, 2));
    await waitFor(() => expect(mockListCatalog).toHaveBeenCalledTimes(2));
  });

  it('shows an action error without refetching when deactivate fails', async () => {
    mockListCatalog.mockResolvedValue({ data: { items: [activeItem], total: 1, page: 1, pageSize: 20 } });
    mockDeactivate.mockRejectedValue({ response: { data: { error: { code: 'CJ_CATALOG_ITEM_NOT_PROMOTED' } } } });
    renderPage();
    const card = await screen.findByTestId('cj-catalog-card-row-2');

    fireEvent.click(within(card).getByTestId('btn-deactivate-2'));

    expect(await screen.findByTestId('action-error')).toHaveTextContent(/aún no ha sido promocionado/i);
    expect(mockListCatalog).toHaveBeenCalledTimes(1);
  });

  describe('CJ connection panel', () => {
    it('shows a configure CTA and never calls listCatalog when no connection is configured', async () => {
      mockGetConnection.mockRejectedValue({ response: { data: { error: { code: 'CJ_CONNECTION_NOT_FOUND' } } } });
      renderPage();

      expect(await screen.findByTestId('btn-configure-connection')).toBeInTheDocument();
      expect(screen.queryByTestId('cj-catalog-table')).not.toBeInTheDocument();
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
      expect(mockListCatalog).not.toHaveBeenCalled();
    });

    it('renders the connection panel and the catalog together when a connection exists', async () => {
      mockListCatalog.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } });
      renderPage();

      expect(await screen.findByTestId('cj-connection-panel')).toBeInTheDocument();
      expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
      expect(mockListCatalog).toHaveBeenCalled();
    });

    it('configures a connection successfully and updates the panel', async () => {
      mockGetConnection.mockRejectedValue({ response: { data: { error: { code: 'CJ_CONNECTION_NOT_FOUND' } } } });
      mockConfigureConnection.mockResolvedValue({
        data: { ...baseConnection, status: 'Disconnected', externalAccountRef: 'cj-account-123' },
      });
      renderPage();

      fireEvent.click(await screen.findByTestId('btn-configure-connection'));
      const modal = await screen.findByTestId('modal-configure-cj-connection');
      fireEvent.change(within(modal).getByTestId('input-external-account-ref'), {
        target: { value: 'cj-account-123' },
      });
      fireEvent.click(within(modal).getByTestId('btn-modal-save-connection'));

      await waitFor(() => expect(mockConfigureConnection).toHaveBeenCalledWith(3, { externalAccountRef: 'cj-account-123' }));
      expect(await screen.findByTestId('cj-connection-status')).toHaveTextContent('Desconectado');
      expect(screen.getByTestId('cj-connection-panel')).toHaveTextContent('cj-account-123');
    });

    it('verifies successfully and shows a healthy result', async () => {
      mockListCatalog.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } });
      mockVerifyConnection.mockResolvedValue({ data: { healthy: true } });
      renderPage();

      fireEvent.click(await screen.findByTestId('btn-verify-connection'));

      expect(await screen.findByTestId('cj-verify-result')).toHaveTextContent(/Conexión correcta/i);
      expect(mockGetConnection).toHaveBeenCalledTimes(2);
    });

    it('surfaces the backend reason when verification is unhealthy', async () => {
      mockListCatalog.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } });
      mockVerifyConnection.mockResolvedValue({
        data: { healthy: false, reason: 'CJ Dropshipping rejected the configured credentials or is unreachable' },
      });
      renderPage();

      fireEvent.click(await screen.findByTestId('btn-verify-connection'));

      expect(await screen.findByTestId('cj-verify-result')).toHaveTextContent(
        'CJ Dropshipping rejected the configured credentials or is unreachable'
      );
    });

    it('shows a rate-limit message on a 429 from verify, not a generic error', async () => {
      mockListCatalog.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } });
      mockVerifyConnection.mockRejectedValue({ response: { status: 429 } });
      renderPage();

      fireEvent.click(await screen.findByTestId('btn-verify-connection'));

      expect(await screen.findByTestId('cj-connection-error')).toHaveTextContent(/demasiados intentos/i);
    });

    it('disables the verify button while the request is in flight', async () => {
      mockListCatalog.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } });
      mockVerifyConnection.mockReturnValue(new Promise(() => {}));
      renderPage();

      const button = await screen.findByTestId('btn-verify-connection');
      fireEvent.click(button);

      await waitFor(() => expect(button).toBeDisabled());
    });

    it('disables sync unless the connection is Connected', async () => {
      mockGetConnection.mockResolvedValue({ data: { ...baseConnection, status: 'Disconnected' } });
      mockListCatalog.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } });
      renderPage();

      expect(await screen.findByTestId('btn-sync-catalog')).toBeDisabled();
    });

    it('runs a sync successfully, shows the result summary, and refetches the catalog', async () => {
      mockListCatalog.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } });
      mockSync.mockResolvedValue({ data: { itemsUpserted: 3, itemsFailed: 1, syncedAt: '2026-01-01T00:00:00.000Z' } });
      renderPage();

      await screen.findByTestId('cj-connection-panel');
      expect(mockListCatalog).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('btn-sync-catalog'));

      expect(await screen.findByTestId('cj-sync-result')).toHaveTextContent('3');
      expect(screen.getByTestId('cj-sync-result')).toHaveTextContent('1 con error');
      await waitFor(() => expect(mockListCatalog).toHaveBeenCalledTimes(2));
    });

    it('keeps the verify result visible through a delayed background connection refresh (no premature panel remount)', async () => {
      mockListCatalog.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } });
      mockGetConnection
        .mockResolvedValueOnce({ data: baseConnection })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ data: { ...baseConnection, status: 'Connected' } }), 20)
            )
        );
      mockVerifyConnection.mockResolvedValue({ data: { healthy: true } });
      renderPage();

      fireEvent.click(await screen.findByTestId('btn-verify-connection'));

      expect(await screen.findByTestId('cj-verify-result')).toHaveTextContent(/Conexión correcta/i);
      await waitFor(() => expect(mockGetConnection).toHaveBeenCalledTimes(2));
      expect(screen.queryByTestId('connection-loading-state')).not.toBeInTheDocument();
      expect(screen.getByTestId('cj-verify-result')).toHaveTextContent(/Conexión correcta/i);
    });

    it('does not clear the bulk selection or refetch the catalog when Verify triggers a delayed background connection refresh', async () => {
      mockListCatalog.mockResolvedValue({ data: { items: [notPromotedItem], total: 1, page: 1, pageSize: 20 } });
      mockGetConnection
        .mockResolvedValueOnce({ data: baseConnection })
        .mockImplementationOnce(
          () => new Promise((resolve) => setTimeout(() => resolve({ data: baseConnection }), 20))
        );
      mockVerifyConnection.mockResolvedValue({ data: { healthy: true } });
      renderPage();

      const card = await screen.findByTestId('cj-catalog-card-row-1');
      fireEvent.click(within(card).getByTestId('checkbox-select-1'));
      await screen.findByTestId('bulk-action-bar');

      fireEvent.click(screen.getByTestId('btn-verify-connection'));
      await waitFor(() => expect(mockGetConnection).toHaveBeenCalledTimes(2));

      expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
      expect(mockListCatalog).toHaveBeenCalledTimes(1);
    });

    it('shows an error message, not the not-configured CTA, when the initial connection fetch fails with a non-404 error', async () => {
      mockGetConnection.mockRejectedValue({ response: { data: { error: { code: 'INTERNAL_SERVER_ERROR' } } } });
      mockListCatalog.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } });
      renderPage();

      expect(await screen.findByText(/error inesperado/i)).toBeInTheDocument();
      expect(screen.queryByTestId('btn-configure-connection')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cj-connection-panel')).not.toBeInTheDocument();
      await waitFor(() => expect(mockListCatalog).toHaveBeenCalled());
    });
  });
});
