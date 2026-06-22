import React from 'react';
import { useTranslation } from 'react-i18next';

interface PriceTagProps {
  publicPrice: number;
  compareAtPrice?: number | null;
}

const PriceTag: React.FC<PriceTagProps> = ({ publicPrice, compareAtPrice }) => {
  const { i18n } = useTranslation();
  const hasSale = compareAtPrice != null && compareAtPrice > publicPrice;

  const formatPrice = (price: number): string =>
    new Intl.NumberFormat(i18n.language === 'en' ? 'en-IE' : 'es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);

  return (
    <span className="storefront-price">
      {hasSale && (
        <span className="storefront-price__original">{formatPrice(compareAtPrice!)}</span>
      )}
      <span className={hasSale ? 'storefront-price__sale' : ''}>
        {formatPrice(publicPrice)}
      </span>
    </span>
  );
};

export default PriceTag;
