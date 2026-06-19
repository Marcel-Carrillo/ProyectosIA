import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OrderConfirmationPage from '../OrderConfirmationPage';

const mockGetOrderPaymentStatus = jest.fn();

jest.mock('../../../services/paymentService', () => ({
  getOrderPaymentStatus: (...args: unknown[]) => mockGetOrderPaymentStatus(...args),
}));

function renderPage(locationState?: object) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/order-confirmation/ORD-001', state: locationState }]}
    >
      <Routes>
        <Route path="/order-confirmation/:orderNumber" element={<OrderConfirmationPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('OrderConfirmationPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows order number without polling when no paymentStatus=processing', () => {
    renderPage({ order: { orderNumber: 'ORD-001', totalAmount: '29.99', paymentStatus: 'Paid' } });
    expect(screen.getByText('ORD-001')).toBeInTheDocument();
    expect(screen.queryByTestId('payment-polling')).not.toBeInTheDocument();
  });

  it('shows polling spinner when paymentStatus=processing', () => {
    mockGetOrderPaymentStatus.mockResolvedValue('PendingPayment');
    renderPage({ order: { orderNumber: 'ORD-001', totalAmount: '29.99' }, paymentStatus: 'processing' });
    expect(screen.getByTestId('payment-polling')).toBeInTheDocument();
  });

  it('shows success alert when polling returns Paid', async () => {
    mockGetOrderPaymentStatus.mockResolvedValue('Paid');
    renderPage({ order: { orderNumber: 'ORD-001', totalAmount: '29.99' }, paymentStatus: 'processing' });
    await waitFor(() => expect(screen.getByTestId('payment-success')).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it('shows failed alert when polling returns Failed', async () => {
    mockGetOrderPaymentStatus.mockResolvedValue('Failed');
    renderPage({ order: { orderNumber: 'ORD-001', totalAmount: '29.99' }, paymentStatus: 'processing' });
    await waitFor(() => expect(screen.getByTestId('payment-failed')).toBeInTheDocument(), {
      timeout: 3000,
    });
  });
});
