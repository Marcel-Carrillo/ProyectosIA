import React from 'react';
import { Link } from 'react-router-dom';
import { Product, ProductVariant } from '../../types/product';
import PriceTag from './PriceTag';

interface ProductCardProps {
  product: Product;
}

const PLACEHOLDER_IMG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"%3E%3Crect width="300" height="400" fill="%23ebebeb"/%3E%3Cpath d="M130 160 h40 v20 h20 l-40 60 -40-60 h20z" fill="%239a9a9a"/%3E%3C/svg%3E';

function getLowestPriceVariant(variants?: ProductVariant[]): ProductVariant | null {
  if (!variants?.length) return null;
  const active = variants.filter((v) => !v.deletedAt && v.status === 'Active');
  if (!active.length) return variants[0] ?? null;
  return active.reduce((min, v) => (v.publicPrice < min.publicPrice ? v : min), active[0]);
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const firstImage = product.images?.[0] ?? null;
  const imageUrl = product.mainImageUrl || firstImage?.url || PLACEHOLDER_IMG;
  const imageAlt = product.mainImageUrl ? product.name : firstImage?.altText || product.name;

  const lowestVariant = getLowestPriceVariant(product.variants);

  return (
    <Link to={`/catalog/${product.id}`} className="storefront-card">
      <div className="storefront-card__image-wrap">
        <img
          src={imageUrl}
          alt={imageAlt}
          className="storefront-card__image"
          loading="lazy"
        />
      </div>
      {product.brand && (
        <p className="storefront-card__brand">{product.brand}</p>
      )}
      <p className="storefront-card__name">{product.name}</p>
      {lowestVariant && (
        <PriceTag
          publicPrice={lowestVariant.publicPrice}
          compareAtPrice={lowestVariant.compareAtPrice}
        />
      )}
    </Link>
  );
};

export default ProductCard;
