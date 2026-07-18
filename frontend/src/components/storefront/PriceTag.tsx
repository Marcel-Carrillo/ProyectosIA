import React from 'react';
import { useTranslation } from 'react-i18next';
import { getUiLocale } from '../../utils/uiLocale';

interface PriceTagProps {
  publicPrice: number;
  compareAtPrice?: number | null;
}

const PriceTag: React.FC<PriceTagProps> = ({ publicPrice, compareAtPrice }) => {
  const { i18n } = useTranslation();
  const hasSale = compareAtPrice != null && compareAtPrice > publicPrice;
  const locale = getUiLocale(i18n.resolvedLanguage || i18n.language);

  const formatPrice = (price: number): string =>
    new Intl.NumberFormat(locale === 'en' ? 'en-IE' : 'es-ES', {
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
