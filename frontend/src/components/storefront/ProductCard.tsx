import React from 'react';
import { Link } from 'react-router-dom';
import { Product, ProductVariant } from '../../types/product';
import PriceTag from './PriceTag';

interface ProductCardProps {
  product: Product;
}

const PLACEHOLDER_IMG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"%3E%3Crect width="300" height="400" fill="%23f5f4f1"/%3E%3Cpath d="M130 160 h40 v20 h20 l-40 60 -40-60 h20z" fill="%236b6a66"/%3E%3C/svg%3E';

function getLowestPriceVariant(variants?: ProductVariant[]): ProductVariant | null {
  if (!variants?.length) return null;
  const active = variants.filter((v) => !v.deletedAt && v.status === 'Active');
  if (!active.length) return variants[0] ?? null;
  return active.reduce((min, v) => (v.publicPrice < min.publicPrice ? v : min), active[0]);
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const firstImage = product.images?.[0] ?? null;
  const secondImage = product.images?.[1] ?? null;
  const primaryUrl = product.mainImageUrl || firstImage?.url || PLACEHOLDER_IMG;
  const secondaryUrl = secondImage?.url ?? null;
  const imageAlt = firstImage?.altText || product.name;

  const lowestVariant = getLowestPriceVariant(product.variants);

  return (
    <Link to={`/catalog/${product.id}`} className="storefront-card">
      <div className="storefront-card__image-wrap">
        <img
          src={primaryUrl}
          alt={imageAlt}
          className="storefront-card__image storefront-card__image--primary"
          loading="lazy"
        />
        {secondaryUrl && (
          <img
            src={secondaryUrl}
            alt=""
            aria-hidden
            className="storefront-card__image storefront-card__image--secondary"
            loading="lazy"
          />
        )}
      </div>
      <div className="storefront-card__meta">
        <div className="storefront-card__info">
          <p className="storefront-card__name">{product.name}</p>
          {product.brand && (
            <p className="storefront-card__brand">{product.brand}</p>
          )}
        </div>
        {lowestVariant && (
          <div className="storefront-card__price">
            <PriceTag
              publicPrice={lowestVariant.publicPrice}
              compareAtPrice={lowestVariant.compareAtPrice}
            />
          </div>
        )}
      </div>
    </Link>
  );
};

export default ProductCard;
