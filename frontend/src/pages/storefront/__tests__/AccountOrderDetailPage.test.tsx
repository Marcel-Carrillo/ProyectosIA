import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';

const mockGetMyOrder = jest.fn();
const mockResumeOrderPayment = jest.fn();
const mockCancelOrder = jest.fn();
const mockGetStripeConfig = jest.fn();
const mockLoadStripe = jest.fn();

jest.mock('../../../services/customerAuthService', () => ({
  getMyOrder: (...args: unknown[]) => mockGetMyOrder(...args),
  resumeOrderPayment: (...args: unknown[]) => mockResumeOrderPayment(...args),
  cancelOrder: (...args: unknown[]) => mockCancelOrder(...args),
  extractOrderActionErrorCode: (error: unknown) =>
    (error as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code ??
    'UNKNOWN_ERROR',
}));

jest.mock('../../../services/paymentService', () => ({
  getStripeConfig: (...args: unknown[]) => mockGetStripeConfig(...args),
}));

jest.mock('@stripe/stripe-js', () => ({
  loadStripe: (...args: unknown[]) => mockLoadStripe(...args),
}));

jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children, options }: { children: React.ReactNode; options?: { clientSecret?: string } }) => (
    <div data-testid="elements-mock" data-clientsecret={options?.clientSecret}>
      {children}
    </div>
  ),
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: jest.fn() }),
  useElements: () => ({}),
}));

jest.mock('../../../contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    customer: { firstName: 'Ana', lastName: 'García', email: 'ana@example.com' },
    logout: jest.fn(),
  }),
}));

// eslint-disable-next-line import/first -- must load after jest.mock() calls above (CRA's resetMocks:true requires mock factories to be defined before the module under test is required)
import AccountOrderDetailPage from '../AccountOrderDetailPage';

const pendingOrder = {
  id: 1,
  orderNumber: 'ORD-001',
  status: 'PendingPayment',
  paymentStatus: 'Pending',
  shippingStatus: 'Preparing',
  shipments: [] as Array<{
    status: string;
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  }>,
  subtotalAmount: '29.99',
  shippingAmount: '0',
  discountAmount: '0',
  totalAmount: '29.99',
  currency: 'EUR',
  createdAt: new Date().toISOString(),
  items: [],
};

function renderPage() {
  return renderWithI18n(
    <MemoryRouter initialEntries={['/account/orders/1']}>
      <Routes>
        <Route path="/account/orders/:id" element={<AccountOrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
    { lng: 'en' }
  );
}

describe('AccountOrderDetailPage - pending payment actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStripeConfig.mockResolvedValue({ publishableKey: 'pk_test_123', mode: 'test' });
    mockLoadStripe.mockResolvedValue({});
  });

  it('shows Complete payment and Cancel order actions for a PendingPayment order', async () => {
    mockGetMyOrder.mockResolvedValue(pendingOrder);
    renderPage();
    expect(await screen.findByTestId('btn-resume-payment')).toBeInTheDocument();
    expect(await screen.findByTestId('btn-cancel-order')).toBeInTheDocument();
  });

  it('hides both actions for a non-pending order (Paid)', async () => {
    mockGetMyOrder.mockResolvedValue({ ...pendingOrder, status: 'Paid' });
    renderPage();
    expect(await screen.findByText(/ORD-001/)).toBeInTheDocument();
    expect(screen.queryByTestId('btn-resume-payment')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-cancel-order')).not.toBeInTheDocument();
  });

  it('resume flow success: mounts Elements/PaymentForm with the returned clientSecret', async () => {
    mockGetMyOrder.mockResolvedValue(pendingOrder);
    mockResumeOrderPayment.mockResolvedValue({ order: pendingOrder, clientSecret: 'secret_abc' });
    renderPage();
    await screen.findByTestId('btn-resume-payment');
    await waitFor(() => expect(mockLoadStripe).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('btn-resume-payment'));
    expect(await screen.findByTestId('resume-payment-panel')).toBeInTheDocument();
    expect(screen.getByTestId('elements-mock')).toHaveAttribute('data-clientsecret', 'secret_abc');
    expect(mockResumeOrderPayment).toHaveBeenCalledWith(1);
  });

  it('resume flow error: shows mapped message for ORDER_NOT_PAYABLE', async () => {
    mockGetMyOrder.mockResolvedValue(pendingOrder);
    mockResumeOrderPayment.mockRejectedValue({ response: { data: { error: { code: 'ORDER_NOT_PAYABLE' } } } });
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-resume-payment'));
    expect(await screen.findByTestId('order-action-error')).toHaveTextContent(/no longer be paid/i);
  });

  it('cancel flow success: confirming calls cancelOrder and re-renders with Cancelled status (actions disappear)', async () => {
    mockGetMyOrder.mockResolvedValue(pendingOrder);
    mockCancelOrder.mockResolvedValue({ ...pendingOrder, status: 'Cancelled', fulfillmentStatus: 'Cancelled' });
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-cancel-order'));
    fireEvent.click(await screen.findByTestId('btn-confirm-cancel'));
    await waitFor(() => expect(mockCancelOrder).toHaveBeenCalledWith(1));
    expect(screen.queryByTestId('btn-cancel-order')).not.toBeInTheDocument();
  });

  it('cancel flow error: shows mapped message for ORDER_NOT_CANCELLABLE and keeps order pending', async () => {
    mockGetMyOrder.mockResolvedValue(pendingOrder);
    mockCancelOrder.mockRejectedValue({ response: { data: { error: { code: 'ORDER_NOT_CANCELLABLE' } } } });
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-cancel-order'));
    fireEvent.click(await screen.findByTestId('btn-confirm-cancel'));
    expect(await screen.findByTestId('order-action-error')).toHaveTextContent(/no longer be cancelled/i);
    expect(await screen.findByTestId('btn-cancel-order')).toBeInTheDocument();
  });

  it('cancel flow cancelled by user: dismissing confirmation does not call cancelOrder', async () => {
    mockGetMyOrder.mockResolvedValue(pendingOrder);
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-cancel-order'));
    fireEvent.click(await screen.findByTestId('btn-dismiss-cancel'));
    expect(mockCancelOrder).not.toHaveBeenCalled();
    expect(screen.queryByTestId('cancel-order-confirm')).not.toBeInTheDocument();
    expect(await screen.findByTestId('btn-cancel-order')).toBeInTheDocument();
  });
});

describe('AccountOrderDetailPage - shipping status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStripeConfig.mockResolvedValue({ publishableKey: 'pk_test_123', mode: 'test' });
    mockLoadStripe.mockResolvedValue({});
  });

  it('hides the shipping section while the order is PendingPayment', async () => {
    mockGetMyOrder.mockResolvedValue(pendingOrder);
    renderPage();
    expect(await screen.findByTestId('btn-resume-payment')).toBeInTheDocument();
    expect(screen.queryByTestId('shipping-section')).not.toBeInTheDocument();
  });

  it('shows the shipping badge and a tracking link for a Paid order with a Shipped shipment', async () => {
    mockGetMyOrder.mockResolvedValue({
      ...pendingOrder,
      status: 'Paid',
      shippingStatus: 'Shipped',
      shipments: [
        {
          status: 'Shipped',
          carrier: 'GLS',
          trackingNumber: 'GLS123456',
          trackingUrl: 'https://tracking.example.com/GLS123456',
          shippedAt: '2026-07-01T00:00:00.000Z',
          deliveredAt: null,
        },
      ],
    });
    renderPage();
    expect(await screen.findByTestId('shipping-section')).toBeInTheDocument();
    expect(screen.getByTestId('shipping-status-badge')).toHaveTextContent(/shipped/i);
    const trackingLink = screen.getByTestId('tracking-link-0');
    expect(trackingLink).toHaveAttribute('href', 'https://tracking.example.com/GLS123456');
    expect(trackingLink).toHaveTextContent('GLS123456');
  });

  it('shows Problem status when a shipment is Failed', async () => {
    mockGetMyOrder.mockResolvedValue({
      ...pendingOrder,
      status: 'Paid',
      shippingStatus: 'Problem',
      shipments: [
        {
          status: 'Failed',
          carrier: 'GLS',
          trackingNumber: null,
          trackingUrl: null,
          shippedAt: null,
          deliveredAt: null,
        },
      ],
    });
    renderPage();
    expect(await screen.findByTestId('shipping-status-badge')).toHaveTextContent(/issue/i);
  });
});
