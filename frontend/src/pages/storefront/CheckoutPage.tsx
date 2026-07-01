import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useCart } from '../../contexts/CartContext';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { authenticatedCheckout, guestCheckout, validateCoupon } from '../../services/checkoutService';
import { getStripeConfig } from '../../services/paymentService';
import { PublicOrder } from '../../types/auth';
import PaymentForm from '../../components/storefront/PaymentForm';
import PriceTag from '../../components/storefront/PriceTag';
import Seo from '../../components/storefront/Seo';

const emptyAddress = {
  fullName: '',
  streetLine1: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'Spain',
};

const ADDRESS_LABELS: Record<keyof typeof emptyAddress, string> = {
  fullName: 'Full name',
  streetLine1: 'Street address',
  city: 'City',
  province: 'Province',
  postalCode: 'Postal code',
  country: 'Country',
};

type Step = 'details' | 'payment';

const CheckoutPage: React.FC = () => {
  const { items, clearCart } = useCart();
  const { isAuthenticated, customer } = useCustomerAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('details');
  const [pendingOrder, setPendingOrder] = useState<PublicOrder | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  const [guest, setGuest] = useState({ email: '', firstName: '', lastName: '', phone: '' });
  const [shipping, setShipping] = useState(emptyAddress);
  const [billing, setBilling] = useState(emptyAddress);
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + parseFloat(i.publicPrice) * i.quantity, 0),
    [items]
  );
  const total = subtotal - discount;

  useEffect(() => {
    getStripeConfig()
      .then(({ publishableKey }) => setStripePromise(loadStripe(publishableKey)))
      .catch(() => setError('Payment provider unavailable. Please try again later.'));
  }, []);

  if (!items.length && step === 'details') return <Navigate to="/cart" replace />;

  const applyCoupon = async () => {
    if (!couponCode) return;
    const result = await validateCoupon(couponCode, subtotal.toFixed(2), customer?.id);
    if (result.valid && result.discountAmount) {
      setDiscount(parseFloat(result.discountAmount));
      setError('');
    } else {
      setDiscount(0);
      setError(result.reason ? `Coupon: ${result.reason}` : 'Invalid coupon');
    }
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const payload = {
      items: items.map((i) => ({ productVariantId: i.productVariantId, quantity: i.quantity })),
      shippingAddressSnapshot: shipping,
      billingAddressSnapshot: billing,
      shippingAmount: '0',
      couponCode: couponCode || undefined,
    };
    try {
      const result = isAuthenticated
        ? await authenticatedCheckout(payload)
        : await guestCheckout({
            ...payload,
            email: guest.email,
            firstName: guest.firstName,
            lastName: guest.lastName,
            phone: guest.phone || undefined,
          });
      setPendingOrder(result);
      setStep('payment');
    } catch {
      setError('Order creation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    clearCart();
    navigate(`/order-confirmation/${pendingOrder!.orderNumber}`, {
      state: { order: pendingOrder, paymentStatus: 'processing' },
    });
  };

  if (step === 'payment' && pendingOrder?.clientSecret && stripePromise) {
    return (
      <div className="storefront-checkout storefront-animate-fade-up">
        <Seo title="Payment | Mavile" noindex />
        <p className="storefront-checkout__eyebrow">Mavile</p>
        <h1 className="storefront-checkout__title">Payment</h1>
        {error && <p className="storefront-auth__error" role="alert">{error}</p>}
        <div className="storefront-checkout__card">
          <Elements stripe={stripePromise} options={{ clientSecret: pendingOrder.clientSecret }}>
            <PaymentForm
              orderNumber={pendingOrder.orderNumber}
              onSuccess={handlePaymentSuccess}
              onError={setError}
            />
          </Elements>
        </div>
        <button
          type="button"
          className="storefront-btn storefront-btn--text"
          onClick={() => { setStep('details'); setError(''); }}
        >
          Back to details
        </button>
      </div>
    );
  }

  return (
    <div className="storefront-checkout storefront-animate-fade-up">
      <Seo title="Checkout | Mavile" noindex />
      <p className="storefront-checkout__eyebrow">Mavile</p>
      <h1 className="storefront-checkout__title">Checkout</h1>

      {error && <p className="storefront-auth__error" role="alert">{error}</p>}

      <form onSubmit={handleDetailsSubmit} className="storefront-checkout__form">
        {!isAuthenticated && (
          <section className="storefront-checkout__section">
            <h2 className="storefront-checkout__section-title">Contact</h2>
            <div className="storefront-checkout__grid">
              <label className="storefront-field storefront-field--wide">
                <span className="storefront-field__label">Email</span>
                <input className="storefront-field__input" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} required />
              </label>
              <label className="storefront-field">
                <span className="storefront-field__label">First name</span>
                <input className="storefront-field__input" value={guest.firstName} onChange={(e) => setGuest({ ...guest, firstName: e.target.value })} required />
              </label>
              <label className="storefront-field">
                <span className="storefront-field__label">Last name</span>
                <input className="storefront-field__input" value={guest.lastName} onChange={(e) => setGuest({ ...guest, lastName: e.target.value })} required />
              </label>
            </div>
          </section>
        )}

        {isAuthenticated && customer && (
          <p className="storefront-checkout__note">
            Checking out as {customer.firstName} {customer.lastName} ({customer.email})
          </p>
        )}

        <section className="storefront-checkout__section">
          <h2 className="storefront-checkout__section-title">Shipping address</h2>
          <div className="storefront-checkout__grid">
            {(Object.keys(emptyAddress) as Array<keyof typeof emptyAddress>).map((key) => (
              <label className="storefront-field" key={key}>
                <span className="storefront-field__label">{ADDRESS_LABELS[key]}</span>
                <input
                  className="storefront-field__input"
                  value={shipping[key]}
                  onChange={(e) => setShipping({ ...shipping, [key]: e.target.value })}
                  required
                />
              </label>
            ))}
          </div>
        </section>

        <section className="storefront-checkout__section">
          <h2 className="storefront-checkout__section-title">Billing address</h2>
          <div className="storefront-checkout__grid">
            {(Object.keys(emptyAddress) as Array<keyof typeof emptyAddress>).map((key) => (
              <label className="storefront-field" key={`bill-${key}`}>
                <span className="storefront-field__label">{ADDRESS_LABELS[key]}</span>
                <input
                  className="storefront-field__input"
                  value={billing[key]}
                  onChange={(e) => setBilling({ ...billing, [key]: e.target.value })}
                  required
                />
              </label>
            ))}
          </div>
        </section>

        <section className="storefront-checkout__section">
          <h2 className="storefront-checkout__section-title">Coupon</h2>
          <div className="storefront-checkout__coupon">
            <label className="storefront-field storefront-field--grow">
              <span className="storefront-field__label">Code</span>
              <input className="storefront-field__input" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
            </label>
            <button type="button" className="storefront-btn storefront-btn--secondary" onClick={applyCoupon}>
              Apply
            </button>
          </div>
        </section>

        <aside className="storefront-checkout__summary">
          <dl>
            <div className="storefront-cart__summary-row">
              <dt>Subtotal</dt>
              <dd><PriceTag publicPrice={subtotal} /></dd>
            </div>
            <div className="storefront-cart__summary-row">
              <dt>Discount</dt>
              <dd><PriceTag publicPrice={discount} /></dd>
            </div>
          </dl>
          <div className="storefront-cart__summary-total">
            <dt>Total</dt>
            <dd><PriceTag publicPrice={total} /></dd>
          </div>
        </aside>

        <button
          type="submit"
          className="storefront-btn storefront-btn--primary storefront-btn--press"
          disabled={submitting}
          data-testid="btn-continue-to-payment"
        >
          {submitting ? 'Preparing order…' : 'Continue to payment'}
        </button>

        <Link to="/cart" className="storefront-btn storefront-btn--text">Back to cart</Link>
      </form>
    </div>
  );
};

export default CheckoutPage;
