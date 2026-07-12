import React, { useState, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductImage } from '../../types/product';

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
  selectedColor?: string | null;
}

const PLACEHOLDER_IMG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"%3E%3Crect width="600" height="800" fill="%23ebebeb"/%3E%3Cpath d="M260 320 h80 v40 h40 l-80 120 -80-120 h40z" fill="%239a9a9a"/%3E%3C/svg%3E';

const ProductGallery: React.FC<ProductGalleryProps> = ({ images, productName, selectedColor }) => {
  const { t } = useTranslation('product');
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  // selectedColor is treated the same whether it's `undefined` (prop omitted
  // — no variant selector on this product) or `null` (a variant is selected
  // but has no color dimension) — both mean "no color filtering".
  const colorFiltered =
    selectedColor != null
      ? sorted.filter((img) => img.color === selectedColor || img.color === null)
      : sorted;

  // Mandatory fallback: never render an empty gallery because of filtering.
  const displayed = colorFiltered.length > 0 ? colorFiltered : sorted;

  const [activeIdx, setActiveIdx] = useState(0);

  // useLayoutEffect (not useEffect) so the reset is applied before the
  // browser paints — avoids a one-frame flash where a stale activeIdx from
  // the previous color momentarily indexes past the new displayed set.
  useLayoutEffect(() => {
    setActiveIdx(0);
  }, [selectedColor, images]);

  const activeImage = displayed[activeIdx] ?? null;
  const mainSrc = activeImage?.url ?? PLACEHOLDER_IMG;
  const mainAlt = activeImage?.altText || productName;

  return (
    <div className="storefront-gallery">
      <div className="storefront-gallery__main">
        <img src={mainSrc} alt={mainAlt} />
      </div>
      {displayed.length > 1 && (
        <div className="storefront-gallery__thumbs" role="list" aria-label={t('gallery.imagesLabel')}>
          {displayed.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              role="listitem"
              aria-label={img.altText || t('gallery.imageN', { n: idx + 1 })}
              aria-current={idx === activeIdx ? 'true' : undefined}
              onClick={() => setActiveIdx(idx)}
              className={`storefront-gallery__thumb${idx === activeIdx ? ' storefront-gallery__thumb--active' : ''}`}
            >
              <img src={img.url} alt={img.altText || t('gallery.thumbAlt', { name: productName, n: idx + 1 })} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductGallery;
