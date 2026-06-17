import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { productService } from '../../services/productService';
import { Product, ProductVariant } from '../../types/product';
import ProductGallery from '../../components/storefront/ProductGallery';
import VariantSelector from '../../components/storefront/VariantSelector';
import PriceTag from '../../components/storefront/PriceTag';

const ProductPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setNotFound(false);
    setError(null);

    productService
      .getById(Number(id))
      .then((res) => {
        if (res.data.status !== 'Active') {
          setNotFound(true);
        } else {
          setProduct(res.data);
        }
      })
      .catch((err: { response?: { status?: number } }) => {
        if (err?.response?.status === 404) {
          setNotFound(true);
        } else {
          setError('Unable to load product. Please try again later.');
        }
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="storefront-section">
        <div className="storefront-container">
          <div className="storefront-pdp-skeleton">
            <div className="storefront-skeleton" style={{ aspectRatio: '3/4', width: '100%' }} />
            <div>
              <div className="storefront-skeleton" style={{ height: 16, width: '70%', marginBottom: 12 }} />
              <div className="storefront-skeleton" style={{ height: 24, width: '90%', marginBottom: 16 }} />
              <div className="storefront-skeleton" style={{ height: 20, width: '30%', marginBottom: 32 }} />
              <div className="storefront-skeleton" style={{ height: 80, width: '100%' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="storefront-section">
        <div className="storefront-container">
          <div className="storefront-empty">
            <p className="storefront-empty__title">Product not found</p>
            <p>This product may no longer be available.</p>
            <Link
              to="/catalog"
              style={{
                display: 'inline-block',
                marginTop: 16,
                padding: '10px 20px',
                background: 'var(--color-near-black)',
                color: 'var(--color-white)',
                textDecoration: 'none',
                fontSize: 'var(--font-size-sm)',
                letterSpacing: '0.06em',
              }}
            >
              Back to catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="storefront-section">
        <div className="storefront-container">
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              background: 'var(--color-error-bg)',
              color: 'var(--color-error)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const priceVariant = selectedVariant ?? product.variants?.find((v) => !v.deletedAt) ?? null;

  return (
    <div className="storefront-section">
      <div className="storefront-container">
        <div className="storefront-pdp-grid">
          <ProductGallery images={product.images ?? []} productName={product.name} />

          <div style={{ paddingTop: 8 }}>
            {product.brand && (
              <p
                style={{
                  fontSize: 'var(--font-size-xs)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--color-mid)',
                  marginBottom: 8,
                }}
              >
                {product.brand}
              </p>
            )}

            <h1
              style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 'var(--font-weight-regular)' as React.CSSProperties['fontWeight'],
                letterSpacing: '-0.01em',
                margin: '0 0 16px',
              }}
            >
              {product.name}
            </h1>

            {priceVariant && (
              <div style={{ marginBottom: 24, fontSize: 'var(--font-size-md)' }}>
                <PriceTag
                  publicPrice={priceVariant.publicPrice}
                  compareAtPrice={priceVariant.compareAtPrice}
                />
              </div>
            )}

            {product.variants && product.variants.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <VariantSelector
                  variants={product.variants}
                  onVariantChange={setSelectedVariant}
                />
              </div>
            )}

            {product.description && (
              <p
                style={{
                  fontSize: 'var(--font-size-base)',
                  lineHeight: 1.7,
                  color: 'var(--color-near-black)',
                  marginBottom: 32,
                }}
              >
                {product.description}
              </p>
            )}

            <button
              type="button"
              aria-label="Add to cart (not yet available)"
              style={{
                width: '100%',
                minHeight: 48,
                background: 'var(--color-near-black)',
                color: 'var(--color-white)',
                border: 'none',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family-body)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
