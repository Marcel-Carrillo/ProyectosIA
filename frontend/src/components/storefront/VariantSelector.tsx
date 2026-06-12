import React, { useState, useEffect } from 'react';
import { ProductVariant } from '../../types/product';

interface VariantSelectorProps {
  variants: ProductVariant[];
  onVariantChange: (variant: ProductVariant | null) => void;
}

function getActiveVariants(variants: ProductVariant[]): ProductVariant[] {
  return variants.filter((v) => !v.deletedAt);
}

function getDistinctValues(variants: ProductVariant[], key: 'size' | 'color'): string[] {
  const seen = new Set<string>();
  variants.forEach((v) => {
    if (v[key]) seen.add(v[key] as string);
  });
  return Array.from(seen);
}

function findVariant(
  variants: ProductVariant[],
  size: string | null,
  color: string | null
): ProductVariant | null {
  return (
    variants.find(
      (v) => !v.deletedAt && v.size === size && v.color === color
    ) ?? null
  );
}

const VariantSelector: React.FC<VariantSelectorProps> = ({ variants, onVariantChange }) => {
  const active = getActiveVariants(variants);
  const sizes = getDistinctValues(active, 'size');
  const colors = getDistinctValues(active, 'color');

  const [selectedSize, setSelectedSize] = useState<string | null>(sizes[0] ?? null);
  const [selectedColor, setSelectedColor] = useState<string | null>(colors[0] ?? null);

  // Reset selection when the product changes (variants prop reference changes)
  useEffect(() => {
    const newActive = getActiveVariants(variants);
    const newSizes = getDistinctValues(newActive, 'size');
    const newColors = getDistinctValues(newActive, 'color');
    setSelectedSize(newSizes[0] ?? null);
    setSelectedColor(newColors[0] ?? null);
  }, [variants]);

  useEffect(() => {
    if (!sizes.length && !colors.length) {
      onVariantChange(active[0] ?? null);
      return;
    }
    const match = findVariant(active, selectedSize, selectedColor);
    onVariantChange(match);
  }, [selectedSize, selectedColor, variants]); // eslint-disable-line react-hooks/exhaustive-deps

  const isCombinationAvailable = (size: string | null, color: string | null): boolean =>
    active.some((v) => v.size === size && v.color === color);

  if (!sizes.length && !colors.length) return null;

  return (
    <div>
      {sizes.length > 0 && (
        <div className="storefront-variant-group">
          <p className="storefront-variant-label">Size</p>
          <div className="storefront-variant-options">
            {sizes.map((size) => {
              const available = isCombinationAvailable(size, selectedColor);
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  disabled={!available}
                  aria-pressed={selectedSize === size}
                  aria-label={`Size ${size}${!available ? ' (unavailable)' : ''}`}
                  className={`storefront-variant-btn${selectedSize === size ? ' storefront-variant-btn--active' : ''}`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {colors.length > 0 && (
        <div className="storefront-variant-group">
          <p className="storefront-variant-label">Color</p>
          <div className="storefront-variant-options">
            {colors.map((color) => {
              const available = isCombinationAvailable(selectedSize, color);
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  disabled={!available}
                  aria-pressed={selectedColor === color}
                  aria-label={`Color ${color}${!available ? ' (unavailable)' : ''}`}
                  className={`storefront-variant-btn${selectedColor === color ? ' storefront-variant-btn--active' : ''}`}
                >
                  {color}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VariantSelector;
