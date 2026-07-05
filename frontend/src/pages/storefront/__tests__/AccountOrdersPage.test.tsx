import React from 'react';
import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';

const mockListMyOrders = jest.fn();

jest.mock('../../../services/customerAuthService', () => ({
  listMyOrders: (...args: unknown[]) => mockListMyOrders(...args),
}));

jest.mock('../../../contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    customer: { firstName: 'Ana', lastName: 'García', email: 'ana@example.com' },
    logout: jest.fn(),
  }),
}));

// eslint-disable-next-line import/first -- must load after jest.mock() calls above
import AccountOrdersPage from '../AccountOrdersPage';

function renderPage() {
  return renderWithI18n(
    <MemoryRouter>
      <AccountOrdersPage />
    </MemoryRouter>,
    { lng: 'en' }
  );
}

describe('AccountOrdersPage - pending payment indicator', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a quick action linking to the order detail page for PendingPayment orders', async () => {
    mockListMyOrders.mockResolvedValue([
      { id: 1, orderNumber: 'ORD-001', totalAmount: '29.99', status: 'PendingPayment' },
    ]);
    renderPage();
    const cta = await screen.findByTestId('resume-cta-1');
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/account/orders/1');
  });

  it('hides the quick action for non-pending orders', async () => {
    mockListMyOrders.mockResolvedValue([
      { id: 2, orderNumber: 'ORD-002', totalAmount: '19.99', status: 'Paid', shippingStatus: 'Preparing' },
    ]);
    renderPage();
    expect(await screen.findByText('ORD-002')).toBeInTheDocument();
    expect(screen.queryByTestId('resume-cta-2')).not.toBeInTheDocument();
  });
});

describe('AccountOrdersPage - shipping status badge', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a shipping-status badge for non-pending orders', async () => {
    mockListMyOrders.mockResolvedValue([
      { id: 3, orderNumber: 'ORD-003', totalAmount: '49.99', status: 'Paid', shippingStatus: 'Shipped' },
    ]);
    renderPage();
    expect(await screen.findByTestId('shipping-badge-3')).toHaveTextContent(/shipped/i);
  });

  it('hides the shipping-status badge for PendingPayment orders', async () => {
    mockListMyOrders.mockResolvedValue([
      { id: 4, orderNumber: 'ORD-004', totalAmount: '15.00', status: 'PendingPayment', shippingStatus: 'Preparing' },
    ]);
    renderPage();
    expect(await screen.findByTestId('resume-cta-4')).toBeInTheDocument();
    expect(screen.queryByTestId('shipping-badge-4')).not.toBeInTheDocument();
  });
});
