import { StorefrontCategoryKey } from './storefrontCategories';

export type CatalogHeroSlideKey = 'slide1' | 'slide2' | 'slide3' | 'slide4' | 'slide5';
export type CatalogHeroVariantKey = CatalogHeroSlideKey | StorefrontCategoryKey | 'search';
export type CatalogHeroMotion = 'zoom-in' | 'zoom-out' | 'pan-right' | 'pan-left' | 'drift-up';

export interface CatalogHeroImageSet {
  image: string;
  variant: CatalogHeroVariantKey;
  motion?: CatalogHeroMotion;
}

/** Curated Unsplash imagery — editorial fashion, warm neutrals, Mavile tone. */
export const CATALOG_HERO_DEFAULT_SLIDES: CatalogHeroImageSet[] = [
  {
    variant: 'slide1',
    motion: 'zoom-in',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1800&q=80',
  },
  {
    variant: 'slide2',
    motion: 'pan-right',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1800&q=80',
  },
  {
    variant: 'slide3',
    motion: 'zoom-out',
    // Replaces a retired Unsplash asset (404) that left slide 3 without a background.
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1800&q=80',
  },
  {
    variant: 'slide4',
    motion: 'pan-left',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1800&q=80',
  },
  {
    variant: 'slide5',
    motion: 'drift-up',
    image: 'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?auto=format&fit=crop&w=1800&q=80',
  },
];

export const CATALOG_HERO_CATEGORY_IMAGES: Record<StorefrontCategoryKey, string> = {
  women: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1800&q=80',
  men: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1800&q=80',
  accessories: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1800&q=80',
  shoes: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1800&q=80',
};

export const CATALOG_HERO_SEARCH_IMAGE =
  'https://images.unsplash.com/photo-1441984904996-e0b87bdff85f?auto=format&fit=crop&w=1800&q=80';

export const CATALOG_HERO_ROTATE_MS = 7000;
