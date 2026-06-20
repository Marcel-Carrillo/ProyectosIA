import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import PriceTag from '../../components/storefront/PriceTag';

const PLACEHOLDER_IMG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="112" height="149" viewBox="0 0 112 149"%3E%3Crect width="112" height="149" fill="%23f5f4f1"/%3E%3C/svg%3E';

const CartPage: React.FC = () => {
  const { items, updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();

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
        <p className="storefront-cart-empty__eyebrow">Your cart</p>
        <h1 className="storefront-cart-empty__title">A pause before you choose.</h1>
        <p className="storefront-cart-empty__text">
          Your cart is empty. Return to the catalog to explore our latest selection.
        </p>
        <Link to="/catalog" className="storefront-btn storefront-btn--text">
          Browse catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="storefront-cart storefront-animate-fade-in">
      <div className="storefront-cart__header">
        <h1 className="storefront-cart__title">Cart</h1>
        <span className="storefront-cart__count">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
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
                      aria-label="Decrease quantity"
                      onClick={() => updateQuantity(item.productVariantId, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
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
                    Remove
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
          <h2 className="storefront-cart__summary-title">Summary</h2>
          <dl>
            <div className="storefront-cart__summary-row">
              <dt>Subtotal</dt>
              <dd><PriceTag publicPrice={subtotal} /></dd>
            </div>
            <div className="storefront-cart__summary-row">
              <dt>Shipping</dt>
              <dd>{shipping === 0 ? 'Free' : <PriceTag publicPrice={shipping} />}</dd>
            </div>
          </dl>
          <div className="storefront-cart__summary-total">
            <dt>Total</dt>
            <dd><PriceTag publicPrice={total} /></dd>
          </div>

          <div className="storefront-cart__summary-actions">
            <button
              type="button"
              className="storefront-btn storefront-btn--primary storefront-btn--press"
              onClick={() => navigate('/checkout')}
            >
              Checkout
            </button>
          </div>

          <div className="storefront-cart__summary-links">
            <Link to="/catalog">Continue shopping</Link>
          </div>

          <p className="storefront-cart__note">
            Free shipping on orders over €100. Free returns within 30 days.
          </p>
        </aside>
      </div>
    </div>
  );
};

export default CartPage;
