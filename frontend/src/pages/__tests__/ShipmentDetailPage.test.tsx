import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ShipmentDetailPage from '../ShipmentDetailPage';

const mockGetById = jest.fn();
const mockUpdateStatus = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../../services/shipmentService', () => ({
  shipmentService: {
    getById: (...args: unknown[]) => mockGetById(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  },
  extractShipmentErrorMessage: () => 'An error occurred',
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const pendingShipment = {
  id: 1,
  customerOrderId: 10,
  supplierOrderId: null,
  carrier: 'FedEx',
  trackingNumber: 'TRK-001',
  trackingUrl: 'https://example.com/track/TRK-001',
  status: 'Pending' as const,
  shippedAt: null,
  deliveredAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  customerOrder: { id: 10, orderNumber: 'ORD-000010', status: 'Confirmed' },
  supplierOrder: null,
};

const deliveredShipment = { ...pendingShipment, status: 'Delivered' as const };

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/shipments/1']}>
      <Routes>
        <Route path="/admin/shipments/:id" element={<ShipmentDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ShipmentDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading spinner initially', () => {
    mockGetById.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders shipment details', async () => {
    mockGetById.mockResolvedValue({ success: true, data: pendingShipment, message: 'ok' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Shipment #1')).toBeInTheDocument());
    expect(screen.getByText('FedEx')).toBeInTheDocument();
    expect(screen.getByText(/ORD-000010/i)).toBeInTheDocument();
  });

  it('shows allowed transitions for Pending', async () => {
    mockGetById.mockResolvedValue({ success: true, data: pendingShipment, message: 'ok' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Shipment #1')).toBeInTheDocument());
    expect(screen.getByText('→ Shipped')).toBeInTheDocument();
    expect(screen.getByText('→ Failed')).toBeInTheDocument();
    expect(screen.getByText('→ Returned')).toBeInTheDocument();
  });

  it('shows terminal state message for Delivered', async () => {
    mockGetById.mockResolvedValue({ success: true, data: deliveredShipment, message: 'ok' });
    renderPage();
    await waitFor(() => expect(screen.getByText(/terminal state/i)).toBeInTheDocument());
  });

  it('calls updateStatus when transition button clicked', async () => {
    mockGetById.mockResolvedValue({ success: true, data: pendingShipment, message: 'ok' });
    const shipped = { ...pendingShipment, status: 'Shipped' as const, shippedAt: '2024-01-02T00:00:00.000Z' };
    mockUpdateStatus.mockResolvedValue({ success: true, data: shipped, message: 'ok' });
    renderPage();
    await waitFor(() => expect(screen.getByText('→ Shipped')).toBeInTheDocument());
    fireEvent.click(screen.getByText('→ Shipped'));
    await waitFor(() => expect(mockUpdateStatus).toHaveBeenCalledWith(1, { status: 'Shipped' }));
  });

  it('navigates back on Back button click', async () => {
    mockGetById.mockResolvedValue({ success: true, data: pendingShipment, message: 'ok' });
    renderPage();
    await waitFor(() => expect(screen.getByText('← Back')).toBeInTheDocument());
    fireEvent.click(screen.getByText('← Back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
