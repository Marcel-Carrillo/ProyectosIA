import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const VALID_SLUGS = [
  'shipping',
  'returns',
  'size-guide',
  'contact',
  'our-story',
  'materials',
  'sustainability',
  'press',
  'privacy',
  'legal',
] as const;

type ContentSlug = (typeof VALID_SLUGS)[number];

interface ContentSection {
  heading: string;
  body: string;
}

const ContentPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation('pages');

  if (!slug || !VALID_SLUGS.includes(slug as ContentSlug)) {
    return <Navigate to="/catalog" replace />;
  }

  const sections = t(`${slug}.sections`, { returnObjects: true }) as ContentSection[] | string;
  const sectionList = Array.isArray(sections) ? sections : [];

  return (
    <article className="storefront-content-page storefront-animate-fade-up">
      <div className="storefront-container storefront-content-page__inner">
        <Link to="/catalog" className="storefront-content-page__back">
          {t('backToShop')}
        </Link>
        <p className="storefront-content-page__eyebrow">{t(`${slug}.eyebrow`)}</p>
        <h1 className="storefront-content-page__title">{t(`${slug}.title`)}</h1>
        <p className="storefront-content-page__intro">{t(`${slug}.intro`)}</p>
        <div className="storefront-content-page__sections">
          {sectionList.map((section) => (
            <section key={section.heading} className="storefront-content-page__section">
              <h2 className="storefront-content-page__section-title">{section.heading}</h2>
              <p className="storefront-content-page__section-body">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
};

export default ContentPage;
