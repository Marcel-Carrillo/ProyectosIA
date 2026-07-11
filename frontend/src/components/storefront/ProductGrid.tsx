import React from 'react';
import { useTranslation } from 'react-i18next';
import { Product } from '../../types/product';
import ProductCard from './ProductCard';

interface ProductGridProps {
  products: Product[];
  isLoading: boolean;
  isEmpty: boolean;
}

const SkeletonCard: React.FC = () => (
  <div>
    <div
      className="storefront-skeleton"
      style={{ width: '100%', paddingBottom: '133%', marginBottom: 12 }}
    />
    <div className="storefront-skeleton" style={{ height: 12, width: '60%', marginBottom: 6 }} />
    <div className="storefront-skeleton" style={{ height: 12, width: '40%' }} />
  </div>
);

const ProductGrid: React.FC<ProductGridProps> = ({ products, isLoading, isEmpty }) => {
  const { t } = useTranslation('product');
  if (isLoading) {
    return (
      <div className="storefront-grid" aria-busy="true" aria-label={t('grid.loading')}>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="storefront-empty">
        <p className="storefront-empty__title">{t('grid.emptyTitle')}</p>
        <p>{t('grid.emptyText')}</p>
      </div>
    );
  }

  return (
    <div className="storefront-grid">
      {products.map((product, index) => (
        <div
          key={product.id}
          className="storefront-animate-fade-up"
          style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
        >
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  );
};

export default ProductGrid;
