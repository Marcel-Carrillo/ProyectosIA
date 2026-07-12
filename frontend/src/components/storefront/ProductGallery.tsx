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
  //
  // The main/hero image must show the SELECTED COLOR's own photo, not just
  // whichever image happens to sort first. The shared (color: null) image
  // is almost always sortOrder 0, so defaulting to index 0 here would leave
  // the hero image stuck on the generic shot every time a color with its
  // own photo is picked — only the thumbnail strip would visibly react.
  // Prefer the first image matching the selected color; fall back to index
  // 0 (the shared image, or whatever the fallback list's first item is)
  // only when that color has no dedicated photo.
  useLayoutEffect(() => {
    const colorIdx = selectedColor != null ? displayed.findIndex((img) => img.color === selectedColor) : -1;
    setActiveIdx(colorIdx >= 0 ? colorIdx : 0);
    // `displayed` is intentionally omitted: it's a new array every render
    // (from .sort()/.filter()), so including it would re-run this on every
    // render instead of only when the effective image set can change.
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
