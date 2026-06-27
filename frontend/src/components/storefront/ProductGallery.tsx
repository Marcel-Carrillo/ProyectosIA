import React, { useState, useMemo, useEffect } from 'react';
import { ProductImage } from '../../types/product';

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
  selectedColor?: string | null;
}

const PLACEHOLDER_IMG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"%3E%3Crect width="600" height="800" fill="%23ebebeb"/%3E%3Cpath d="M260 320 h80 v40 h40 l-80 120 -80-120 h40z" fill="%239a9a9a"/%3E%3C/svg%3E';

const ProductGallery: React.FC<ProductGalleryProps> = ({ images, productName, selectedColor }) => {
  const sorted = useMemo(() => [...images].sort((a, b) => a.sortOrder - b.sortOrder), [images]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!selectedColor) return;
    const idx = sorted.findIndex((img) =>
      img.altText?.toLowerCase().includes(selectedColor.toLowerCase()),
    );
    if (idx !== -1) setActiveIdx(idx);
  }, [selectedColor, sorted]);

  const activeImage = sorted[activeIdx] ?? null;
  const mainSrc = activeImage?.url ?? PLACEHOLDER_IMG;
  const mainAlt = activeImage?.altText || productName;

  return (
    <div className="storefront-gallery">
      <div className="storefront-gallery__main">
        <img src={mainSrc} alt={mainAlt} />
      </div>
      {sorted.length > 1 && (
        <div className="storefront-gallery__thumbs" role="list" aria-label="Product images">
          {sorted.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              role="listitem"
              aria-label={img.altText || `Image ${idx + 1}`}
              aria-current={idx === activeIdx ? 'true' : undefined}
              onClick={() => setActiveIdx(idx)}
              className={`storefront-gallery__thumb${idx === activeIdx ? ' storefront-gallery__thumb--active' : ''}`}
            >
              <img src={img.url} alt={img.altText || `${productName} thumbnail ${idx + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductGallery;
