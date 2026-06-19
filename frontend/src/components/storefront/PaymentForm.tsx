import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Alert, Button, Form } from 'react-bootstrap';

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
        // requires_action or redirect — Stripe.js handles the redirect
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
    <Form onSubmit={handlePay}>
      <PaymentElement />
      {paymentError && (
        <Alert variant="danger" className="mt-3" data-testid="payment-error">
          {paymentError}
        </Alert>
      )}
      <Button
        type="submit"
        disabled={!stripe || paying}
        className="w-100 mt-3"
        data-testid="btn-pay"
      >
        {paying ? 'Processing…' : 'Pay now'}
      </Button>
    </Form>
  );
}
