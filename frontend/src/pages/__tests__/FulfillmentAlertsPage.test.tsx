import { vi, type Mocked } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FulfillmentAlertsPage from '../FulfillmentAlertsPage';
import { fulfillmentAlertService } from '../../services/fulfillmentAlertService';

vi.mock('../../services/fulfillmentAlertService');
const mocked = fulfillmentAlertService as Mocked<typeof fulfillmentAlertService>;

beforeEach(() => vi.clearAllMocks());

function renderPage() {
  return render(
    <MemoryRouter>
      <FulfillmentAlertsPage />
    </MemoryRouter>
  );
}

describe('FulfillmentAlertsPage', () => {
  it('renders unresolved alerts by default', async () => {
    mocked.list.mockResolvedValue({
      success: true,
      message: '',
      data: {
        items: [
          {
            id: 1,
            type: 'CjPushFailed',
            customerOrderId: 10,
            supplierOrderId: 20,
            message: 'CJ API unavailable',
            resolvedAt: null,
            createdAt: '2026-07-13T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });

    renderPage();

    expect(await screen.findByTestId('alert-row-1')).toBeInTheDocument();
    expect(mocked.list).toHaveBeenCalledWith(expect.objectContaining({ resolved: false }));
  });

  it('shows an empty state with no alerts', async () => {
    mocked.list.mockResolvedValue({ success: true, message: '', data: { items: [], total: 0, page: 1, pageSize: 20 } });

    renderPage();

    const table = await screen.findByTestId('alerts-table');
    expect(await within(table).findByText(/no hay alertas/i)).toBeInTheDocument();
  });

  it('toggles to include resolved alerts when the switch is checked', async () => {
    mocked.list.mockResolvedValue({ success: true, message: '', data: { items: [], total: 0, page: 1, pageSize: 20 } });

    renderPage();
    const table = await screen.findByTestId('alerts-table');
    await within(table).findByText(/no hay alertas/i);

    fireEvent.click(screen.getByRole('checkbox', { name: /mostrar resueltas/i }));

    await waitFor(() =>
      expect(mocked.list).toHaveBeenLastCalledWith(expect.not.objectContaining({ resolved: false }))
    );
  });

  it('links to the affected customer and supplier order', async () => {
    mocked.list.mockResolvedValue({
      success: true,
      message: '',
      data: {
        items: [
          {
            id: 1,
            type: 'CjPushFailed',
            customerOrderId: 10,
            supplierOrderId: 20,
            message: 'CJ API unavailable',
            resolvedAt: null,
            createdAt: '2026-07-13T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });

    renderPage();

    expect(await screen.findByTestId('alert-customer-order-link-1')).toHaveTextContent('#10');
    expect(screen.getByTestId('alert-supplier-order-link-1')).toHaveTextContent('#20');
  });

  it('shows an error message when the request fails', async () => {
    mocked.list.mockRejectedValue(new Error('network error'));

    renderPage();

    expect(await screen.findByText(/no se pudieron cargar/i)).toBeInTheDocument();
  });
});
