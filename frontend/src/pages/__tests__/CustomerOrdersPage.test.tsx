import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomerOrdersPage from '../CustomerOrdersPage';
import { CustomerOrder } from '../../types/customerOrder';
import { customerOrderService } from '../../services/customerOrderService';

jest.mock('../../services/customerOrderService', () => ({
  customerOrderService: { list: jest.fn() },
}));

const mockedList = customerOrderService.list as jest.Mock;

const mockOrder: CustomerOrder = {
  id: 1,
  orderNumber: 'ORD-000001',
  customerId: 1,
  status: 'Paid',
  paymentStatus: 'Paid',
  fulfillmentStatus: 'NotStarted',
  subtotalAmount: '50.00',
  shippingAmount: '0',
  discountAmount: '0',
  totalAmount: '50.00',
  currency: 'EUR',
  shippingAddressSnapshot: {
    fullName: 'Jane',
    streetLine1: 'Main',
    city: 'Malaga',
    province: 'Malaga',
    postalCode: '29001',
    country: 'Spain',
  },
  billingAddressSnapshot: {
    fullName: 'Jane',
    streetLine1: 'Main',
    city: 'Malaga',
    province: 'Malaga',
    postalCode: '29001',
    country: 'Spain',
  },
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
  customer: { id: 1, firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
};

const listResult = (items: CustomerOrder[]) => ({
  success: true,
  data: { items, total: items.length, page: 1, pageSize: 20 },
  message: '',
});

const renderPage = (initial = '/customer-orders') =>
  render(
    <MemoryRouter initialEntries={[initial]}>
      <CustomerOrdersPage />
    </MemoryRouter>
  );

describe('CustomerOrdersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedList.mockResolvedValue(listResult([mockOrder]));
  });

  it('renders orders from list service', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('order-link-1')).toBeInTheDocument());
    expect(mockedList).toHaveBeenCalled();
  });

  it('passes date range params to list service', async () => {
    jest.useFakeTimers();
    renderPage();
    await waitFor(() => expect(mockedList).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('order-date-from'), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByTestId('order-date-to'), { target: { value: '2026-06-30' } });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() =>
      expect(mockedList).toHaveBeenCalledWith(
        expect.objectContaining({ createdFrom: '2026-06-01', createdTo: '2026-06-30' })
      )
    );
    jest.useRealTimers();
  });

  it('shows empty state', async () => {
    mockedList.mockResolvedValue(listResult([]));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('orders-empty')).toBeInTheDocument());
  });

  it('shows error state', async () => {
    mockedList.mockRejectedValue(new Error('fail'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Unable to load customer orders/i)).toBeInTheDocument()
    );
  });
});
