import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useCart } from '../../contexts/CartContext';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { authenticatedCheckout, guestCheckout, validateCoupon } from '../../services/checkoutService';
import { getStripeConfig } from '../../services/paymentService';
import { addressService, SelfServiceCustomerAddress } from '../../services/addressService';
import { PublicOrder } from '../../types/auth';
import PaymentForm from '../../components/storefront/PaymentForm';
import PriceTag from '../../components/storefront/PriceTag';
import Seo from '../../components/storefront/Seo';
import { apiErrorKey } from '../../utils/apiErrorKey';

const emptyAddress = {
  fullName: '',
  phone: '',
  streetLine1: '',
  streetLine2: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'Spain',
};

const OPTIONAL_ADDRESS_FIELDS = new Set<keyof typeof emptyAddress>(['phone', 'streetLine2']);

function addressToFormState(addr: SelfServiceCustomerAddress): typeof emptyAddress {
  return {
    fullName: addr.fullName,
    phone: addr.phone ?? '',
    streetLine1: addr.streetLine1,
    streetLine2: addr.streetLine2 ?? '',
    city: addr.city,
    province: addr.province,
    postalCode: addr.postalCode,
    country: addr.country,
  };
}

type Step = 'details' | 'payment';

const CheckoutPage: React.FC = () => {
  const { t } = useTranslation('checkout');
  const { items, clearCart } = useCart();
  const { isAuthenticated, customer } = useCustomerAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('details');
  const [pendingOrder, setPendingOrder] = useState<PublicOrder | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  const [guest, setGuest] = useState({ email: '', firstName: '', lastName: '', phone: '' });
  const [shipping, setShipping] = useState(emptyAddress);
  const [billing, setBilling] = useState(emptyAddress);
  const [sameAsShipping, setSameAsShipping] = useState(false);
  const [saveShippingDefault, setSaveShippingDefault] = useState(false);
  const [saveBillingDefault, setSaveBillingDefault] = useState(false);
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
      .catch(() => setError(t('errors.PAYMENT_GATEWAY_UNAVAILABLE', { ns: 'common' })));
  }, []);

  // Prefill shipping/billing from the buyer's default addresses, falling
  // back to profile-only prefill (name/phone) when no default exists. Guest
  // buyers never run this — their forms start empty.
  useEffect(() => {
    if (!isAuthenticated || !customer) return;

    const profileOnly = {
      ...emptyAddress,
      fullName: `${customer.firstName} ${customer.lastName}`.trim(),
      phone: customer.phone ?? '',
    };
    setShipping(profileOnly);
    setBilling(profileOnly);

    let cancelled = false;
    addressService
      .list()
      .then((addresses) => {
        if (cancelled) return;
        const defaultShipping = addresses.find((a) => a.type === 'Shipping' && a.isDefault);
        const defaultBilling = addresses.find((a) => a.type === 'Billing' && a.isDefault);
        if (defaultShipping) setShipping(addressToFormState(defaultShipping));
        if (defaultBilling) setBilling(addressToFormState(defaultBilling));
      })
      .catch(() => {
        // Prefill is a convenience, not a checkout blocker — keep the
        // profile-only baseline already applied above on failure.
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, customer]);

  // "Usar mismos datos": while enabled, billing mirrors shipping and further
  // shipping edits keep propagating.
  useEffect(() => {
    if (sameAsShipping) setBilling(shipping);
  }, [sameAsShipping, shipping]);

  if (!items.length && step === 'details') return <Navigate to="/cart" replace />;

  const applyCoupon = async () => {
    if (!couponCode) return;
    const result = await validateCoupon(couponCode, subtotal.toFixed(2), customer?.id);
    if (result.valid && result.discountAmount) {
      setDiscount(parseFloat(result.discountAmount));
      setError('');
    } else {
      setDiscount(0);
      setError(result.reason ? t('couponReason', { reason: result.reason }) : t('couponInvalid'));
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
    } catch (err) {
      setError(t(apiErrorKey(err), { ns: 'common' }));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = async () => {
    if (isAuthenticated) {
      const saves: Promise<unknown>[] = [];
      if (saveShippingDefault) {
        saves.push(
          addressService
            .create({
              type: 'Shipping',
              isDefault: true,
              fullName: shipping.fullName,
              phone: shipping.phone || undefined,
              streetLine1: shipping.streetLine1,
              streetLine2: shipping.streetLine2 || undefined,
              city: shipping.city,
              province: shipping.province,
              postalCode: shipping.postalCode,
              country: shipping.country,
            })
            .catch((err) => console.error('Failed to save shipping address as default:', err))
        );
      }
      if (saveBillingDefault) {
        const billingSource = sameAsShipping ? shipping : billing;
        saves.push(
          addressService
            .create({
              type: 'Billing',
              isDefault: true,
              fullName: billingSource.fullName,
              phone: billingSource.phone || undefined,
              streetLine1: billingSource.streetLine1,
              streetLine2: billingSource.streetLine2 || undefined,
              city: billingSource.city,
              province: billingSource.province,
              postalCode: billingSource.postalCode,
              country: billingSource.country,
            })
            .catch((err) => console.error('Failed to save billing address as default:', err))
        );
      }
      await Promise.all(saves);
    }
    clearCart();
    navigate(`/order-confirmation/${pendingOrder!.orderNumber}`, {
      state: { order: pendingOrder, paymentStatus: 'processing' },
    });
  };

  if (step === 'payment' && pendingOrder?.clientSecret && stripePromise) {
    return (
      <div className="storefront-checkout storefront-animate-fade-up">
        <Seo title={t('seo.payment')} noindex />
        <p className="storefront-checkout__eyebrow">Mavile</p>
        <h1 className="storefront-checkout__title">{t('paymentTitle')}</h1>
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
          {t('backToDetails')}
        </button>
      </div>
    );
  }

  return (
    <div className="storefront-checkout storefront-animate-fade-up">
      <Seo title={t('seo.checkout')} noindex />
      <p className="storefront-checkout__eyebrow">Mavile</p>
      <h1 className="storefront-checkout__title">{t('title')}</h1>

      {error && <p className="storefront-auth__error" role="alert">{error}</p>}

      <form onSubmit={handleDetailsSubmit} className="storefront-checkout__form">
        {!isAuthenticated && (
          <section className="storefront-checkout__section">
            <h2 className="storefront-checkout__section-title">{t('contact')}</h2>
            <div className="storefront-checkout__grid">
              <label className="storefront-field storefront-field--wide">
                <span className="storefront-field__label">{t('field.email')}</span>
                <input className="storefront-field__input" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} required />
              </label>
              <label className="storefront-field">
                <span className="storefront-field__label">{t('field.firstName')}</span>
                <input className="storefront-field__input" value={guest.firstName} onChange={(e) => setGuest({ ...guest, firstName: e.target.value })} required />
              </label>
              <label className="storefront-field">
                <span className="storefront-field__label">{t('field.lastName')}</span>
                <input className="storefront-field__input" value={guest.lastName} onChange={(e) => setGuest({ ...guest, lastName: e.target.value })} required />
              </label>
            </div>
          </section>
        )}

        {isAuthenticated && customer && (
          <p className="storefront-checkout__note">
            {t('checkingOutAs', {
              name: `${customer.firstName} ${customer.lastName}`,
              email: customer.email,
            })}
          </p>
        )}

        <section className="storefront-checkout__section">
          <h2 className="storefront-checkout__section-title">{t('shippingAddress')}</h2>
          <div className="storefront-checkout__grid">
            {(Object.keys(emptyAddress) as Array<keyof typeof emptyAddress>).map((key) => (
              <label className="storefront-field" key={key}>
                <span className="storefront-field__label">{t(`field.${key}`)}</span>
                <input
                  className="storefront-field__input"
                  value={shipping[key]}
                  onChange={(e) => setShipping({ ...shipping, [key]: e.target.value })}
                  required={!OPTIONAL_ADDRESS_FIELDS.has(key)}
                />
              </label>
            ))}
          </div>
          {isAuthenticated && (
            <label className="storefront-checkout__toggle">
              <input
                type="checkbox"
                checked={saveShippingDefault}
                onChange={(e) => setSaveShippingDefault(e.target.checked)}
                data-testid="checkbox-save-shipping-default"
              />
              <span>{t('saveAsDefault')}</span>
            </label>
          )}
        </section>

        <section className="storefront-checkout__section">
          <h2 className="storefront-checkout__section-title">{t('billingAddress')}</h2>
          <label className="storefront-checkout__toggle">
            <input
              type="checkbox"
              checked={sameAsShipping}
              onChange={(e) => setSameAsShipping(e.target.checked)}
              data-testid="checkbox-same-as-shipping"
            />
            <span>{t('useSameData')}</span>
          </label>
          <div className="storefront-checkout__grid">
            {(Object.keys(emptyAddress) as Array<keyof typeof emptyAddress>).map((key) => (
              <label className="storefront-field" key={`bill-${key}`}>
                <span className="storefront-field__label">{t(`field.${key}`)}</span>
                <input
                  className="storefront-field__input"
                  value={billing[key]}
                  onChange={(e) => setBilling({ ...billing, [key]: e.target.value })}
                  required={!OPTIONAL_ADDRESS_FIELDS.has(key)}
                  disabled={sameAsShipping}
                />
              </label>
            ))}
          </div>
          {isAuthenticated && (
            <label className="storefront-checkout__toggle">
              <input
                type="checkbox"
                checked={saveBillingDefault}
                onChange={(e) => setSaveBillingDefault(e.target.checked)}
                data-testid="checkbox-save-billing-default"
              />
              <span>{t('saveAsDefault')}</span>
            </label>
          )}
        </section>

        <section className="storefront-checkout__section">
          <h2 className="storefront-checkout__section-title">{t('coupon')}</h2>
          <div className="storefront-checkout__coupon">
            <label className="storefront-field storefront-field--grow">
              <span className="storefront-field__label">{t('couponCode')}</span>
              <input className="storefront-field__input" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
            </label>
            <button type="button" className="storefront-btn storefront-btn--secondary" onClick={applyCoupon}>
              {t('applyCoupon')}
            </button>
          </div>
        </section>

        <aside className="storefront-checkout__summary">
          <dl>
            <div className="storefront-cart__summary-row">
              <dt>{t('subtotal')}</dt>
              <dd><PriceTag publicPrice={subtotal} /></dd>
            </div>
            <div className="storefront-cart__summary-row">
              <dt>{t('discount')}</dt>
              <dd><PriceTag publicPrice={discount} /></dd>
            </div>
          </dl>
          <div className="storefront-cart__summary-total">
            <dt>{t('total')}</dt>
            <dd><PriceTag publicPrice={total} /></dd>
          </div>
        </aside>

        <button
          type="submit"
          className="storefront-btn storefront-btn--primary storefront-btn--press"
          disabled={submitting}
          data-testid="btn-continue-to-payment"
        >
          {submitting ? t('preparingOrder') : t('continueToPayment')}
        </button>

        <Link to="/cart" className="storefront-btn storefront-btn--text">{t('backToCart')}</Link>
      </form>
    </div>
  );
};

export default CheckoutPage;
