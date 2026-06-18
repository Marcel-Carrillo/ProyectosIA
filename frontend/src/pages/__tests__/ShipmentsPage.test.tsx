import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ShipmentsPage from '../ShipmentsPage';

const mockList = jest.fn();
const mockCreate = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../../services/shipmentService', () => ({
  shipmentService: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
  },
  extractShipmentErrorMessage: (err: unknown) => 'Error occurred',
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const emptyResponse = {
  success: true,
  data: { items: [], total: 0, page: 1, pageSize: 20 },
  message: 'ok',
};

const shipmentResponse = {
  success: true,
  data: {
    items: [
      {
        id: 1,
        customerOrderId: 10,
        supplierOrderId: null,
        carrier: 'DHL',
        trackingNumber: 'TRK123',
        trackingUrl: null,
        status: 'Pending' as const,
        shippedAt: null,
        deliveredAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
  },
  message: 'ok',
};

describe('ShipmentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading spinner initially', () => {
    mockList.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <ShipmentsPage />
      </MemoryRouter>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders shipments table when data loads', async () => {
    mockList.mockResolvedValue(shipmentResponse);
    render(
      <MemoryRouter>
        <ShipmentsPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getAllByText(/DHL/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/TRK123/i).length).toBeGreaterThan(0);
  });

  it('shows empty state message when no shipments', async () => {
    mockList.mockResolvedValue(emptyResponse);
    render(
      <MemoryRouter>
        <ShipmentsPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getAllByText(/No shipments found/i).length).toBeGreaterThan(0));
  });

  it('opens create modal on button click', async () => {
    mockList.mockResolvedValue(emptyResponse);
    render(
      <MemoryRouter>
        <ShipmentsPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getAllByText(/No shipments found/i).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText('+ New Shipment'));
    expect(screen.getByText('Create Shipment')).toBeInTheDocument();
  });

  it('navigates to detail on View click', async () => {
    mockList.mockResolvedValue(shipmentResponse);
    render(
      <MemoryRouter>
        <ShipmentsPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getAllByText(/DHL/i).length).toBeGreaterThan(0));
    const viewButtons = screen.getAllByText('View');
    fireEvent.click(viewButtons[0]!);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/shipments/1');
  });
});
