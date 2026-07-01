import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import Seo from './Seo';

const renderSeo = (ui: React.ReactElement) =>
  render(<HelmetProvider>{ui}</HelmetProvider>);

describe('Seo', () => {
  it('renders title, description and canonical by default (no robots meta)', async () => {
    renderSeo(<Seo title="Shop All | Mavile" description="Browse the collection" canonicalPath="/catalog" />);
    await waitFor(() => expect(document.title).toBe('Shop All | Mavile'));
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', 'Browse the collection');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toContain('/catalog');
    expect(document.querySelector('meta[name="robots"]')).not.toBeInTheDocument();
  });

  it('renders noindex robots meta when noindex is true', async () => {
    renderSeo(<Seo title="Checkout" noindex />);
    await waitFor(() =>
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
    );
  });

  it('renders a JSON-LD script tag when jsonLd is provided', async () => {
    renderSeo(<Seo title="Product" jsonLd={{ '@type': 'Product', name: 'Dress' }} />);
    await waitFor(() => expect(document.querySelector('script[type="application/ld+json"]')).toBeInTheDocument());
    const script = document.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(script!.textContent ?? '{}')).toEqual({ '@type': 'Product', name: 'Dress' });
  });

  it('renders multiple JSON-LD blocks when an array is provided', async () => {
    renderSeo(<Seo title="PDP" jsonLd={[{ '@type': 'Product' }, { '@type': 'BreadcrumbList' }]} />);
    await waitFor(() => {
      expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(2);
    });
  });

  it('escapes "</script>" in JSON-LD content so it cannot break out of the script tag', async () => {
    renderSeo(<Seo title="Product" jsonLd={{ '@type': 'Product', name: '</script><script>alert(1)</script>' }} />);
    await waitFor(() => expect(document.querySelector('script[type="application/ld+json"]')).toBeInTheDocument());
    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script!.textContent).not.toContain('</script>');
    expect(JSON.parse(script!.textContent ?? '{}')).toEqual({ '@type': 'Product', name: '</script><script>alert(1)</script>' });
  });
});
