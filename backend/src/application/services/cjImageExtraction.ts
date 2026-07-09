export interface ExtractedCjImages {
  productImage?: string;
  variantImage?: string;
}

export interface ImagePlanItem extends ExtractedCjImages {
  altText: string;
}

export interface PlannedImage {
  url: string;
  altText: string;
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
export function planProductImages(items: ImagePlanItem[]): ImagePlan {
  const images: PlannedImage[] = [];
  const seenUrls = new Set<string>();

  function addImage(url: string | undefined, altText: string): void {
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    images.push({ url, altText });
  }

  for (const item of items) {
    if (item.productImage) {
      addImage(item.productImage, item.altText);
      break;
    }
  }
  for (const item of items) {
    addImage(item.variantImage, item.altText);
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
export function extractCjImages(rawPayload: unknown): ExtractedCjImages {
  try {
    if (!isRecord(rawPayload)) return {};

    const result: ExtractedCjImages = {};

    const product = rawPayload['product'];
    if (isRecord(product) && isNonEmptyString(product['bigImage'])) {
      result.productImage = product['bigImage'];
    }

    const variant = rawPayload['variant'];
    if (isRecord(variant) && isNonEmptyString(variant['variantImage'])) {
      result.variantImage = variant['variantImage'];
    }

    return result;
  } catch {
    return {};
  }
}
