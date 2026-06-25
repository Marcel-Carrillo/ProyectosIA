import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

interface PaymentFormProps {
  orderNumber: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export default function PaymentForm({ orderNumber, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaymentError('');
    setPaying(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order-confirmation/${orderNumber}`,
        },
        redirect: 'if_required',
      });
      if (error) {
        const msg = error.message ?? 'Payment failed. Please try again.';
        setPaymentError(msg);
        onError(msg);
      } else if (paymentIntent?.status === 'succeeded') {
        onSuccess();
      } else {
        onSuccess();
      }
    } catch {
      const msg = 'An unexpected error occurred. Please try again.';
      setPaymentError(msg);
      onError(msg);
    } finally {
      setPaying(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="storefront-payment">
      <PaymentElement />
      {paymentError && (
        <p className="storefront-auth__error" role="alert" data-testid="payment-error">
          {paymentError}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || paying}
        className="storefront-btn storefront-btn--primary storefront-btn--press"
        data-testid="btn-pay"
      >
        {paying ? 'Processing…' : 'Pay now'}
      </button>
    </form>
  );
}
