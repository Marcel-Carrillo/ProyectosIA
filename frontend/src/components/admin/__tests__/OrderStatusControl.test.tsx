import { render, screen, fireEvent } from '@testing-library/react';
import OrderStatusControl from '../OrderStatusControl';
import { CustomerOrder } from '../../../types/customerOrder';

const baseOrder: CustomerOrder = {
  id: 1,
  orderNumber: 'ORD-000001',
  customerId: 1,
  status: 'PendingPayment',
  paymentStatus: 'Pending',
  fulfillmentStatus: 'NotStarted',
  subtotalAmount: '50.00',
  shippingAmount: '0.00',
  discountAmount: '0.00',
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
  createdAt: '2026-06-18T00:00:00.000Z',
  updatedAt: '2026-06-18T00:00:00.000Z',
};

describe('OrderStatusControl', () => {
  it('calls onSave with changed payment status only', () => {
    const onSave = jest.fn();
    render(<OrderStatusControl order={baseOrder} saving={false} onSave={onSave} />);
    fireEvent.change(screen.getByTestId('select-payment-status'), { target: { value: 'Paid' } });
    fireEvent.click(screen.getByTestId('btn-save-status'));
    expect(onSave).toHaveBeenCalledWith({ paymentStatus: 'Paid' });
  });
});
