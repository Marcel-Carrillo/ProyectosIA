import { vi } from 'vitest';
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import PaymentForm from '../PaymentForm';

const mockConfirmPayment = vi.fn();
const mockUseStripe = vi.fn();
const mockUseElements = vi.fn();

vi.mock('@stripe/react-stripe-js', () => ({
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => mockUseStripe(),
  useElements: () => mockUseElements(),
}));

describe('PaymentForm', () => {
  const onSuccess = vi.fn();
  const onError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseStripe.mockReturnValue({ confirmPayment: mockConfirmPayment });
    mockUseElements.mockReturnValue({});
  });

  it('renders PaymentElement and pay button', () => {
    renderWithI18n(<PaymentForm orderNumber="ORD-001" onSuccess={onSuccess} onError={onError} />);
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
    expect(screen.getByTestId('btn-pay')).toBeInTheDocument();
  });

  it('disables button while stripe is loading (null)', () => {
    mockUseStripe.mockReturnValue(null);
    renderWithI18n(<PaymentForm orderNumber="ORD-001" onSuccess={onSuccess} onError={onError} />);
    expect(screen.getByTestId('btn-pay')).toBeDisabled();
  });

  it('calls onSuccess when payment succeeds', async () => {
    mockConfirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' }, error: null });
    renderWithI18n(<PaymentForm orderNumber="ORD-001" onSuccess={onSuccess} onError={onError} />);
    fireEvent.submit(screen.getByRole('button', { name: /pay now/i }).closest('form')!);
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('calls onError and shows alert when Stripe returns error', async () => {
    mockConfirmPayment.mockResolvedValue({ error: { message: 'Card declined' }, paymentIntent: null });
    renderWithI18n(<PaymentForm orderNumber="ORD-001" onSuccess={onSuccess} onError={onError} />);
    fireEvent.submit(screen.getByRole('button', { name: /pay now/i }).closest('form')!);
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Card declined'));
    expect(screen.getByTestId('payment-error')).toHaveTextContent('Card declined');
  });

  it('calls onError when confirmPayment throws', async () => {
    mockConfirmPayment.mockRejectedValue(new Error('Network'));
    renderWithI18n(<PaymentForm orderNumber="ORD-001" onSuccess={onSuccess} onError={onError} />);
    fireEvent.submit(screen.getByRole('button', { name: /pay now/i }).closest('form')!);
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});
