import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AccountLayout from '../../components/storefront/AccountLayout';
import PriceTag from '../../components/storefront/PriceTag';
import { listWishlist, removeFromWishlist } from '../../services/wishlistService';

interface WishlistItem {
  id: number;
  productVariantId: number;
  variant: {
    publicPrice: string;
    product: { name: string; id: number };
  };
}

const AccountWishlistPage: React.FC = () => {
  const { t } = useTranslation('account');
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listWishlist()
      .then((data) => setItems(data as WishlistItem[]))
      .catch(() => setError(t('wishlist.errors.load')))
      .finally(() => setLoading(false));
  }, [t]);

  const handleRemove = async (productVariantId: number) => {
    await removeFromWishlist(productVariantId);
    const data = await listWishlist().catch(() => []);
    setItems(data as WishlistItem[]);
  };

  return (
    <AccountLayout title={t('wishlist.title')}>
      <div className="storefront-account__panel">
        <h2 className="storefront-account__panel-title">{t('wishlist.panelTitle')}</h2>
        {error && <p className="storefront-account__alert storefront-account__alert--error" role="alert">{error}</p>}
        {loading ? (
          <p className="storefront-account__loading">{t('common.loading')}</p>
        ) : !items.length ? (
          <div className="storefront-account__empty">
            <p className="storefront-account__empty-title">{t('wishlist.empty.title')}</p>
            <p className="storefront-account__empty-text">{t('wishlist.empty.text')}</p>
            <Link to="/catalog" className="storefront-btn storefront-btn--text">
              {t('common.browseCatalog')}
            </Link>
          </div>
        ) : (
          <ul className="storefront-account__list">
            {items.map((item) => (
              <li key={item.id} className="storefront-account__wishlist-item">
                <div>
                  <Link to={`/catalog/${item.variant.product.id}`} className="storefront-account__wishlist-name">
                    {item.variant.product.name}
                  </Link>
                  <div className="storefront-account__wishlist-price">
                    <PriceTag publicPrice={parseFloat(item.variant.publicPrice)} />
                  </div>
                </div>
                <button
                  type="button"
                  className="storefront-account__remove-btn"
                  onClick={() => handleRemove(item.productVariantId)}
                >
                  {t('wishlist.remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AccountLayout>
  );
};

export default AccountWishlistPage;
