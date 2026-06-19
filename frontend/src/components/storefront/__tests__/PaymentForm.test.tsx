import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PaymentForm from '../PaymentForm';

const mockConfirmPayment = jest.fn();
const mockUseStripe = jest.fn();
const mockUseElements = jest.fn();

jest.mock('@stripe/react-stripe-js', () => ({
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => mockUseStripe(),
  useElements: () => mockUseElements(),
}));

describe('PaymentForm', () => {
  const onSuccess = jest.fn();
  const onError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseStripe.mockReturnValue({ confirmPayment: mockConfirmPayment });
    mockUseElements.mockReturnValue({});
  });

  it('renders PaymentElement and pay button', () => {
    render(<PaymentForm orderNumber="ORD-001" onSuccess={onSuccess} onError={onError} />);
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
    expect(screen.getByTestId('btn-pay')).toBeInTheDocument();
  });

  it('disables button while stripe is loading (null)', () => {
    mockUseStripe.mockReturnValue(null);
    render(<PaymentForm orderNumber="ORD-001" onSuccess={onSuccess} onError={onError} />);
    expect(screen.getByTestId('btn-pay')).toBeDisabled();
  });

  it('calls onSuccess when payment succeeds', async () => {
    mockConfirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' }, error: null });
    render(<PaymentForm orderNumber="ORD-001" onSuccess={onSuccess} onError={onError} />);
    fireEvent.submit(screen.getByRole('button', { name: /pay now/i }).closest('form')!);
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('calls onError and shows alert when Stripe returns error', async () => {
    mockConfirmPayment.mockResolvedValue({ error: { message: 'Card declined' }, paymentIntent: null });
    render(<PaymentForm orderNumber="ORD-001" onSuccess={onSuccess} onError={onError} />);
    fireEvent.submit(screen.getByRole('button', { name: /pay now/i }).closest('form')!);
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Card declined'));
    expect(screen.getByTestId('payment-error')).toHaveTextContent('Card declined');
  });

  it('calls onError when confirmPayment throws', async () => {
    mockConfirmPayment.mockRejectedValue(new Error('Network'));
    render(<PaymentForm orderNumber="ORD-001" onSuccess={onSuccess} onError={onError} />);
    fireEvent.submit(screen.getByRole('button', { name: /pay now/i }).closest('form')!);
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});
