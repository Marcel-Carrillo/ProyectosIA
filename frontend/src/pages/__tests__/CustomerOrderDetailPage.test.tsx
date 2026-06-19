import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CustomerOrderDetailPage from '../CustomerOrderDetailPage';
import { CustomerOrder } from '../../types/customerOrder';
import { customerOrderService } from '../../services/customerOrderService';
import { supplierOrderService } from '../../services/supplierOrderService';
import { refundService } from '../../services/refundService';
import { returnRequestService } from '../../services/returnRequestService';

jest.mock('../../services/customerOrderService', () => ({
  customerOrderService: {
    getById: jest.fn(),
    updateStatus: jest.fn(),
    generateSupplierOrders: jest.fn(),
  },
  extractCustomerOrderErrorMessage: (err: unknown) =>
    err instanceof Error ? err.message : 'error',
}));

jest.mock('../../services/supplierOrderService', () => ({
  supplierOrderService: { listByCustomerOrder: jest.fn() },
}));

jest.mock('../../services/refundService', () => ({
  refundService: { getAll: jest.fn() },
}));

jest.mock('../../services/returnRequestService', () => ({
  returnRequestService: { getAll: jest.fn(), create: jest.fn() },
}));

const mockedGet = customerOrderService.getById as jest.Mock;
const mockedSupplierList = supplierOrderService.listByCustomerOrder as jest.Mock;
const mockedRefunds = refundService.getAll as jest.Mock;
const mockedReturns = returnRequestService.getAll as jest.Mock;

const address = {
  fullName: 'Jane Doe',
  streetLine1: 'Main St',
  city: 'Malaga',
  province: 'Malaga',
  postalCode: '29001',
  country: 'Spain',
};

const mockOrder: CustomerOrder = {
  id: 1,
  orderNumber: 'ORD-000042',
  customerId: 1,
  status: 'Paid',
  paymentStatus: 'Paid',
  fulfillmentStatus: 'NotStarted',
  subtotalAmount: '49.99',
  shippingAmount: '0',
  discountAmount: '0',
  totalAmount: '49.99',
  currency: 'EUR',
  shippingAddressSnapshot: address,
  billingAddressSnapshot: address,
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-06-02T08:00:00.000Z',
  paidAt: '2026-06-01T09:00:00.000Z',
  items: [
    {
      id: 10,
      customerOrderId: 1,
      productVariantId: 2,
      productNameSnapshot: 'Black Midi Dress',
      variantSnapshot: { size: 'S' },
      skuSnapshot: 'BMD-S',
      quantity: 1,
      unitPrice: '49.99',
      totalPrice: '49.99',
      fulfillmentStatus: 'NotStarted',
    },
  ],
  customer: { id: 1, firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
};

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={['/customer-orders/1']}>
      <Routes>
        <Route path="/customer-orders/:id" element={<CustomerOrderDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('CustomerOrderDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue({ success: true, data: mockOrder, message: '' });
    mockedSupplierList.mockResolvedValue({ success: true, data: { items: [] }, message: '' });
    mockedRefunds.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    mockedReturns.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('renders line items and addresses', async () => {
    renderDetail();
    expect(await screen.findByText('ORD-000042')).toBeInTheDocument();
    expect(screen.getByText('Black Midi Dress')).toBeInTheDocument();
    expect(screen.getAllByText(/Main St/).length).toBeGreaterThan(0);
  });

  it('renders status timeline with paid milestone', async () => {
    renderDetail();
    expect(await screen.findByTestId('order-status-timeline')).toBeInTheDocument();
    expect(screen.getByText('Last updated')).toBeInTheDocument();
  });

  it('does not render supplier cost fields', async () => {
    renderDetail();
    await screen.findByText('ORD-000042');
    expect(document.body.textContent).not.toMatch(/supplierCost/i);
    expect(document.body.textContent).not.toMatch(/supplierReference/i);
  });
});
