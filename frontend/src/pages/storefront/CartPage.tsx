import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../../contexts/CartContext';
import PriceTag from '../../components/storefront/PriceTag';
import Seo from '../../components/storefront/Seo';

const PLACEHOLDER_IMG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="112" height="149" viewBox="0 0 112 149"%3E%3Crect width="112" height="149" fill="%23f5f4f1"/%3E%3C/svg%3E';

const CartPage: React.FC = () => {
  const { items, updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();
  const { t } = useTranslation('cart');

  const subtotal = items.reduce(
    (sum, item) => sum + parseFloat(item.publicPrice) * item.quantity,
    0
  );

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const shipping = subtotal >= 100 ? 0 : 8;
  const total = subtotal + (items.length ? shipping : 0);

  if (!items.length) {
    return (
      <div className="storefront-cart-empty storefront-animate-fade-up">
        <Seo title={`${t('title')} | Mavile`} noindex />
        <p className="storefront-cart-empty__eyebrow">{t('empty.eyebrow')}</p>
        <h1 className="storefront-cart-empty__title">{t('empty.title')}</h1>
        <p className="storefront-cart-empty__text">{t('empty.text')}</p>
        <Link to="/catalog" className="storefront-btn storefront-btn--text">
          {t('empty.browseCatalog')}
        </Link>
      </div>
    );
  }

  return (
    <div className="storefront-cart storefront-animate-fade-in">
      <Seo title={`${t('title')} | Mavile`} noindex />
      <div className="storefront-cart__header">
        <h1 className="storefront-cart__title">{t('title')}</h1>
        <span className="storefront-cart__count">
          {t('count', { count: itemCount })}
        </span>
      </div>

      <div className="storefront-cart__layout">
        <ul className="storefront-cart__items">
          {items.map((item, index) => (
            <li
              key={item.productVariantId}
              className="storefront-cart__item storefront-animate-fade-up"
              style={{ animationDelay: `${Math.min(index * 70, 420)}ms` }}
            >
              <span className="storefront-cart__item-image storefront-cart__item-image--hover">
                <img
                  src={item.imageUrl || PLACEHOLDER_IMG}
                  alt={item.productName}
                  loading="lazy"
                />
              </span>

              <div className="storefront-cart__item-body">
                <span className="storefront-cart__item-name">{item.productName}</span>
                <p className="storefront-cart__item-variant">
                  {[item.color, item.size].filter(Boolean).join(' · ')}
                </p>
                <div className="storefront-cart__item-actions">
                  <div className="storefront-cart__qty">
                    <button
                      type="button"
                      aria-label={t('item.decreaseQty')}
                      onClick={() => updateQuantity(item.productVariantId, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      aria-label={t('item.increaseQty')}
                      onClick={() => updateQuantity(item.productVariantId, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="storefront-cart__remove"
                    onClick={() => removeItem(item.productVariantId)}
                  >
                    {t('item.remove')}
                  </button>
                </div>
              </div>

              <p className="storefront-cart__item-price">
                <PriceTag publicPrice={parseFloat(item.publicPrice) * item.quantity} />
              </p>
            </li>
          ))}
        </ul>

        <aside className="storefront-cart__summary">
          <h2 className="storefront-cart__summary-title">{t('summary.title')}</h2>
          <dl>
            <div className="storefront-cart__summary-row">
              <dt>{t('summary.subtotal')}</dt>
              <dd><PriceTag publicPrice={subtotal} /></dd>
            </div>
            <div className="storefront-cart__summary-row">
              <dt>{t('summary.shipping')}</dt>
              <dd>{shipping === 0 ? t('summary.free') : <PriceTag publicPrice={shipping} />}</dd>
            </div>
          </dl>
          <div className="storefront-cart__summary-total">
            <dt>{t('summary.total')}</dt>
            <dd><PriceTag publicPrice={total} /></dd>
          </div>

          <div className="storefront-cart__summary-actions">
            <button
              type="button"
              className="storefront-btn storefront-btn--primary storefront-btn--press"
              onClick={() => navigate('/checkout')}
            >
              {t('summary.checkout')}
            </button>
          </div>

          <div className="storefront-cart__summary-links">
            <Link to="/catalog">{t('summary.continueShopping')}</Link>
          </div>

          <p className="storefront-cart__note">
            {t('summary.note')}
          </p>
        </aside>
      </div>
    </div>
  );
};

export default CartPage;
