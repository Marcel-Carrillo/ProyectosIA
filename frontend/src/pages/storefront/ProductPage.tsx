import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { productService } from '../../services/productService';
import { Product, ProductVariant } from '../../types/product';
import ProductGallery from '../../components/storefront/ProductGallery';
import VariantSelector from '../../components/storefront/VariantSelector';
import PriceTag from '../../components/storefront/PriceTag';
import { useCart } from '../../contexts/CartContext';

const ProductPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
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
            <Link to="/catalog" className="storefront-btn storefront-btn--text">
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
          <div className="storefront-alert" role="alert">
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
        <nav className="storefront-breadcrumb" aria-label="Breadcrumb">
          <Link to="/catalog">Shop</Link>
          <span aria-hidden>›</span>
          <span>{product.name}</span>
        </nav>

        <div className="storefront-pdp-grid">
          <ProductGallery images={product.images ?? []} productName={product.name} />

          <div className="storefront-pdp-info">
            {product.brand && (
              <p className="storefront-pdp-brand">{product.brand}</p>
            )}

            <h1 className="storefront-pdp-title">{product.name}</h1>

            {priceVariant && (
              <div className="storefront-pdp-price">
                <PriceTag
                  publicPrice={priceVariant.publicPrice}
                  compareAtPrice={priceVariant.compareAtPrice}
                />
              </div>
            )}

            {product.variants && product.variants.length > 0 && (
              <VariantSelector
                variants={product.variants}
                onVariantChange={setSelectedVariant}
              />
            )}

            {product.description && (
              <p className="storefront-pdp-description">{product.description}</p>
            )}

            <button
              type="button"
              aria-label="Add to cart"
              disabled={!priceVariant}
              className="storefront-btn storefront-btn--primary"
              onClick={() => {
                if (!priceVariant || !product) return;
                addItem({
                  productVariantId: priceVariant.id,
                  quantity: 1,
                  productName: product.name,
                  size: priceVariant.size,
                  color: priceVariant.color,
                  publicPrice: String(priceVariant.publicPrice),
                  imageUrl: product.mainImageUrl,
                });
                setAdded(true);
                setTimeout(() => setAdded(false), 2000);
              }}
            >
              {added ? 'Added to cart' : 'Add to cart'}
            </button>

            <div className="storefront-pdp-details">
              <dl>
                <div className="storefront-pdp-details-row">
                  <dt>Shipping</dt>
                  <dd>Free from €100</dd>
                </div>
                <div className="storefront-pdp-details-row">
                  <dt>Returns</dt>
                  <dd>30 days</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
