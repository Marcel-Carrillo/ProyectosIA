import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStorefrontCategories } from '../../hooks/useStorefrontCategories';
import { StorefrontCategoryKey } from '../../constants/storefrontCategories';
import {
  CATALOG_HERO_CATEGORY_IMAGES,
  CATALOG_HERO_DEFAULT_SLIDES,
  CATALOG_HERO_ROTATE_MS,
  CATALOG_HERO_SEARCH_IMAGE,
  CatalogHeroVariantKey,
} from '../../constants/catalogHero';

interface CatalogHeroProps {
  categoryId?: number;
  search?: string;
}

function resolveCategoryKey(
  categoryId: number | undefined,
  categoryIds: Partial<Record<StorefrontCategoryKey, number>>,
): StorefrontCategoryKey | null {
  if (!categoryId) return null;
  const entry = Object.entries(categoryIds).find(([, id]) => id === categoryId);
  return entry ? (entry[0] as StorefrontCategoryKey) : null;
}

const CatalogHero: React.FC<CatalogHeroProps> = ({ categoryId, search }) => {
  const { t } = useTranslation('catalog');
  const { categoryIds } = useStorefrontCategories();
  const [slideIndex, setSlideIndex] = useState(0);
  const [textVisible, setTextVisible] = useState(true);
  const [progressKey, setProgressKey] = useState(0);

  const categoryKey = useMemo(
    () => resolveCategoryKey(categoryId, categoryIds),
    [categoryId, categoryIds],
  );

  const mode = search ? 'search' : categoryKey ? 'category' : 'carousel';

  const slides = useMemo(() => {
    if (mode === 'search') {
      return [{ image: CATALOG_HERO_SEARCH_IMAGE, variant: 'search' as CatalogHeroVariantKey }];
    }
    if (mode === 'category' && categoryKey) {
      return [{ image: CATALOG_HERO_CATEGORY_IMAGES[categoryKey], variant: categoryKey }];
    }
    return CATALOG_HERO_DEFAULT_SLIDES;
  }, [mode, categoryKey]);

  const activeSlide = slides[slideIndex % slides.length];
  const textKey = `hero.variants.${activeSlide.variant}`;

  const goToSlide = (index: number) => {
    setTextVisible(false);
    window.setTimeout(() => {
      setSlideIndex(index);
      setProgressKey((k) => k + 1);
      setTextVisible(true);
    }, 280);
  };

  useEffect(() => {
    setSlideIndex(0);
    setTextVisible(true);
    setProgressKey((k) => k + 1);
  }, [mode, categoryKey, search]);

  useEffect(() => {
    if (mode !== 'carousel' || slides.length <= 1) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const id = window.setInterval(() => {
      setTextVisible(false);
      window.setTimeout(() => {
        setSlideIndex((i) => (i + 1) % slides.length);
        setProgressKey((k) => k + 1);
        setTextVisible(true);
      }, 400);
    }, CATALOG_HERO_ROTATE_MS);

    return () => window.clearInterval(id);
  }, [mode, slides.length]);

  const title = search
    ? t('hero.variants.search.title', { query: search })
    : t(`${textKey}.title`);
  const subtitle = search
    ? t('hero.variants.search.subtitle')
    : t(`${textKey}.subtitle`);
  const eyebrow = search
    ? t('hero.variants.search.eyebrow')
    : t(`${textKey}.eyebrow`);

  return (
    <section
      className="storefront-hero storefront-hero--dynamic"
      aria-label={t('hero.ariaLabel')}
      style={{ ['--hero-rotate-ms' as string]: `${CATALOG_HERO_ROTATE_MS}ms` }}
    >
      <div className="storefront-hero__bg" aria-hidden="true">
        {slides.map((slide, index) => {
          const isActive = index === slideIndex % slides.length;
          const motion = slide.motion ?? 'zoom-in';
          return (
            <div
              key={slide.variant}
              className={[
                'storefront-hero__bg-slide',
                `storefront-hero__bg-slide--${motion}`,
                isActive ? 'storefront-hero__bg-slide--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ backgroundImage: `url(${slide.image})` }}
            />
          );
        })}
        <div className="storefront-hero__scrim" />
        <div className="storefront-hero__grain" />
      </div>

      <div className="storefront-hero__inner">
        <div
          className={`storefront-hero__copy${textVisible ? ' storefront-hero__copy--visible' : ''}`}
          key={`${mode}-${activeSlide.variant}-${search ?? ''}-${progressKey}`}
        >
          <p className="storefront-hero__eyebrow">{eyebrow}</p>
          <h1 className="storefront-hero__title">{title}</h1>
          <p className="storefront-hero__subtitle">{subtitle}</p>
        </div>

        {mode === 'carousel' && slides.length > 1 && (
          <div className="storefront-hero__dots" role="tablist" aria-label={t('hero.dotsLabel')}>
            {slides.map((slide, index) => {
              const isActive = index === slideIndex % slides.length;
              return (
                <button
                  key={slide.variant}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={t(`hero.variants.${slide.variant}.title`)}
                  className={`storefront-hero__dot${isActive ? ' storefront-hero__dot--active' : ''}`}
                  onClick={() => goToSlide(index)}
                >
                  {isActive && (
                    <span
                      key={progressKey}
                      className="storefront-hero__dot-progress"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <span className="visually-hidden" aria-live="polite">
        {title}
      </span>
    </section>
  );
};

export default CatalogHero;
