import React from 'react';
import { Helmet } from 'react-helmet-async';

export interface SeoProps {
  title: string;
  description?: string;
  /** Site-relative path, e.g. '/catalog', '/catalog/42', '/pages/shipping'. */
  canonicalPath?: string;
  /** Absolute image URL for Open Graph / Twitter. Falls back to the site default. */
  image?: string;
  noindex?: boolean;
  /** One JSON-LD object, or several (e.g. Product + BreadcrumbList on the PDP). */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export const SITE_URL = (process.env.REACT_APP_SITE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const DEFAULT_OG_IMAGE = `${SITE_URL}/mavile-logo.png`;

const Seo: React.FC<SeoProps> = ({
  title,
  description,
  canonicalPath,
  image,
  noindex = false,
  jsonLd,
}) => {
  const canonicalUrl = canonicalPath ? `${SITE_URL}${canonicalPath}` : undefined;
  const resolvedImage = image ?? DEFAULT_OG_IMAGE;
  const jsonLdBlocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:type" content="website" />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:image" content={resolvedImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={resolvedImage} />

      {jsonLdBlocks.map((block, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <script key={i} type="application/ld+json">
          {/* Escape "<" so a product name/description containing "</script>" cannot break out of the tag. */}
          {JSON.stringify(block).replace(/</g, '\\u003c')}
        </script>
      ))}
    </Helmet>
  );
};

export default Seo;
