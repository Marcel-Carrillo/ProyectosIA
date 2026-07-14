import React, { useState, useLayoutEffect, useRef } from 'react';
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

  // Thumbnail strip ALWAYS shows the full, sorted image set regardless of the
  // selected color — only the hero/main image reacts to color (product-detail
  // spec: "Selecting a color changes only the main gallery image").
  const displayed = sorted;

  const [activeIdx, setActiveIdx] = useState(0);

  // Tracks the previous `images` array reference so the effect below can
  // tell "the product changed" (images reference changed — reset the hero
  // image) apart from "only the color changed on the same product" (images
  // reference unchanged — preserve whatever hero image was already showing
  // when the newly selected color has no dedicated photo).
  const prevImagesRef = useRef(images);

  // useLayoutEffect (not useEffect) so the reset/preserve is applied before
  // the browser paints — avoids a one-frame flash of a stale index.
  useLayoutEffect(() => {
    const imagesChanged = prevImagesRef.current !== images;
    prevImagesRef.current = images;

    const colorIdx = selectedColor != null ? displayed.findIndex((img) => img.color === selectedColor) : -1;

    if (colorIdx >= 0) {
      // The selected color has its own photo — always switch to it.
      setActiveIdx(colorIdx);
    } else if (imagesChanged) {
      // New product and no color match (or no color selected) — start at 0.
      setActiveIdx(0);
    }
    // else: same product, selected color has no dedicated photo — leave the
    // hero image exactly as it was (spec: "the main image remains whatever
    // it was before the selection, and no thumbnail is hidden or removed").
    // `displayed` is intentionally omitted from deps: it's a new array every
    // render (from .sort()), so including it would re-run this on every
    // render instead of only when `images`/`selectedColor` actually change.
  }, [selectedColor, images]); // eslint-disable-line react-hooks/exhaustive-deps

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
