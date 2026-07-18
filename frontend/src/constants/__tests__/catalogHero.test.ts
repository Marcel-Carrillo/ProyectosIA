import { CATALOG_HERO_DEFAULT_SLIDES } from '../catalogHero';

describe('CATALOG_HERO_DEFAULT_SLIDES', () => {
  it('exposes five unique carousel slides with image and motion', () => {
    expect(CATALOG_HERO_DEFAULT_SLIDES).toHaveLength(5);
    const variants = CATALOG_HERO_DEFAULT_SLIDES.map((s) => s.variant);
    expect(new Set(variants).size).toBe(5);
    for (const slide of CATALOG_HERO_DEFAULT_SLIDES) {
      expect(slide.image).toMatch(/^https:\/\/images\.unsplash\.com\//);
      expect(slide.motion).toBeTruthy();
    }
  });
});
