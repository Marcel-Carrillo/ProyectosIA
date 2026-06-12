import React from 'react';

interface PriceTagProps {
  publicPrice: number;
  compareAtPrice?: number | null;
}

const formatPrice = (price: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(price);

const PriceTag: React.FC<PriceTagProps> = ({ publicPrice, compareAtPrice }) => {
  const hasSale = compareAtPrice != null && compareAtPrice > publicPrice;

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
