import { vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SupplierOrderDetailPage from '../SupplierOrderDetailPage';

const mockGetById = vi.fn();
const mockUpdateStatus = vi.fn();
const mockSimulateSandboxAdvance = vi.fn();

vi.mock('../../services/supplierOrderService', () => ({
  supplierOrderService: {
    getById: (...args: unknown[]) => mockGetById(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
    simulateSandboxAdvance: (...args: unknown[]) => mockSimulateSandboxAdvance(...args),
  },
  extractSupplierOrderErrorMessage: () => 'An error occurred',
}));

const baseOrder = {
  id: 1,
  supplierOrderNumber: 'SPO-000001',
  customerOrderId: 10,
  supplierId: 1,
  status: 'Draft' as const,
  sandbox: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  items: [],
  customerOrder: { id: 10, orderNumber: 'ORD-000010' },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/supplier-orders/1']}>
      <Routes>
        <Route path="/supplier-orders/:id" element={<SupplierOrderDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SupplierOrderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "not pushed" message when there is no externalOrderId', async () => {
    mockGetById.mockResolvedValue({ success: true, data: baseOrder, message: 'ok' });
    renderPage();
    expect(await screen.findByText(/todavía no se ha empujado a CJ Dropshipping/i)).toBeInTheDocument();
    expect(screen.queryByTestId('btn-cj-sandbox-advance')).not.toBeInTheDocument();
  });

  it('shows the sandbox-advance button for a pushed sandbox order', async () => {
    mockGetById.mockResolvedValue({
      success: true,
      data: { ...baseOrder, externalOrderId: 'SD123', externalOrderStatus: 'UNSHIPPED' },
      message: 'ok',
    });
    renderPage();
    expect(await screen.findByTestId('btn-cj-sandbox-advance')).toBeInTheDocument();
    expect(screen.getByText('SD123')).toBeInTheDocument();
    expect(screen.getByText('Sandbox')).toBeInTheDocument();
  });

  it('hides the sandbox-advance button for a pushed real (non-sandbox) order', async () => {
    mockGetById.mockResolvedValue({
      success: true,
      data: { ...baseOrder, sandbox: false, externalOrderId: 'REAL123', externalOrderStatus: 'SHIPPED' },
      message: 'ok',
    });
    renderPage();
    expect(await screen.findByText('REAL123')).toBeInTheDocument();
    expect(screen.getByText('Real')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-cj-sandbox-advance')).not.toBeInTheDocument();
  });

  it('calls simulateSandboxAdvance and refreshes the order on click', async () => {
    const pushed = { ...baseOrder, externalOrderId: 'SD123', externalOrderStatus: 'UNSHIPPED' };
    mockGetById.mockResolvedValue({ success: true, data: pushed, message: 'ok' });
    mockSimulateSandboxAdvance.mockResolvedValue({
      success: true,
      data: { ...pushed, externalOrderStatus: 'SHIPPED' },
      message: 'ok',
    });
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-cj-sandbox-advance'));
    await waitFor(() => expect(mockSimulateSandboxAdvance).toHaveBeenCalledWith(1));
    expect(await screen.findByText(/Estado en CJ: SHIPPED/)).toBeInTheDocument();
  });

  it('shows an error message when simulateSandboxAdvance fails', async () => {
    const pushed = { ...baseOrder, externalOrderId: 'SD123', externalOrderStatus: 'UNSHIPPED' };
    mockGetById.mockResolvedValue({ success: true, data: pushed, message: 'ok' });
    mockSimulateSandboxAdvance.mockRejectedValue(new Error('boom'));
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-cj-sandbox-advance'));
    expect(await screen.findByText('An error occurred')).toBeInTheDocument();
  });
});
