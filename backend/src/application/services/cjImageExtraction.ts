import { extractCjVariantAttributesFromRawPayload } from './cjVariantAttributeExtraction';

export interface ExtractedCjImages {
  productImage?: string;
  variantImage?: string;
  color: string | null;
}

export interface ImagePlanItem extends ExtractedCjImages {
  altText: string;
}

export interface PlannedImage {
  url: string;
  altText: string;
  color: string | null;
}

export interface ImagePlan {
  mainImageUrl?: string;
  images: PlannedImage[]; // images[0] is always the main image when present; index = sortOrder
}

// Turns a pid group's per-item extracted images into a single, deduplicated
// image plan. The product-level image (identical across every item in a pid
// group in practice, since it comes from the same CJ product record) is
// preferred as the main image; if no item has one, the first *variant* image
// encountered becomes the main image instead — a product must not end up
// with ProductImage rows but a permanently-null mainImageUrl just because CJ
// only supplied a per-variant photo, not a per-product one.
//
// Dedup key is (url, color), not url alone (design.md D3): two variants of
// different colors sharing a URL must never collapse into one row, while
// same-color variants sharing a URL still collapse into one. The
// product-level image is always planned with color forced to null
// regardless of what extractCjImages derived for that item, since it is
// shared/product-level by definition (design.md D1).
//
// Exception: a variant image whose URL is identical to the chosen
// product-level image is the SAME photo, regardless of what color that
// variant derives — it must never produce a second row (this is the
// pre-existing "variant image matches product image" no-duplicate rule,
// which (url, color) keying alone would otherwise regress whenever the
// matching variant happens to have a derivable color).
export function planProductImages(items: ImagePlanItem[]): ImagePlan {
  const images: PlannedImage[] = [];
  const seenKeys = new Set<string>();
  let productImageUrl: string | undefined;

  function addImage(url: string | undefined, altText: string, color: string | null): void {
    if (!url) return;
    const key = `${url}\0${color ?? ''}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    images.push({ url, altText, color });
  }

  for (const item of items) {
    if (item.productImage) {
      productImageUrl = item.productImage;
      addImage(item.productImage, item.altText, null);
      break;
    }
  }
  for (const item of items) {
    if (item.variantImage && item.variantImage === productImageUrl) continue;
    addImage(item.variantImage, item.altText, item.color);
  }

  return { mainImageUrl: images[0]?.url, images };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// Derives display images from a CjCatalogItem's stored rawPayload
// ({ product, variant } — see cjCatalogSyncService.ts's item-building loop).
// Defensive by construction: every step is a typeof/Array.isArray guard, no
// JSON.parse or external call is involved, so this cannot throw — the
// try/catch below is redundant belt-and-suspenders in case rawPayload's
// actual runtime shape ever surprises this, matching this file's neighboring
// parseSizeColor()'s defensive style (cjCatalogSyncService.ts).
//
// color is derived via extractCjVariantAttributesFromRawPayload — the same
// function ProductVariant.color already uses (cj-variant-attribute-extraction)
// — so an image's color can never disagree with its own variant's color
// (design.md D2). It represents *this item's* derived variant color; callers
// decide whether to apply it (variantImage) or force it to null
// (productImage) — see planProductImages above.
export function extractCjImages(rawPayload: unknown): ExtractedCjImages {
  try {
    if (!isRecord(rawPayload)) return { color: null };

    const result: ExtractedCjImages = { color: null };

    const product = rawPayload['product'];
    if (isRecord(product) && isNonEmptyString(product['bigImage'])) {
      result.productImage = product['bigImage'];
    }

    const variant = rawPayload['variant'];
    if (isRecord(variant) && isNonEmptyString(variant['variantImage'])) {
      result.variantImage = variant['variantImage'];
    }

    result.color = extractCjVariantAttributesFromRawPayload(rawPayload).color;

    return result;
  } catch {
    return { color: null };
  }
}
