import React from 'react';
import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StorefrontFooter from '../StorefrontFooter';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';

jest.mock('../../../hooks/useStorefrontCategories', () => ({
  useStorefrontCategories: () => ({
    getHref: (slug: string) => `/catalog?category=${slug}`,
  }),
}));

function renderFooter(lng: 'es' | 'en' = 'es') {
  return renderWithI18n(
    <MemoryRouter>
      <StorefrontFooter />
    </MemoryRouter>,
    { lng },
  );
}

describe('StorefrontFooter — legal links', () => {
  it('renders Privacy Policy link in Spanish', () => {
    renderFooter('es');
    const link = screen.getByRole('link', { name: 'Política de privacidad' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/pages/privacy');
  });

  it('renders Legal Notice link in Spanish', () => {
    renderFooter('es');
    const link = screen.getByRole('link', { name: 'Aviso legal' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/pages/legal');
  });

  it('renders Privacy Policy link in English', () => {
    renderFooter('en');
    const link = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/pages/privacy');
  });

  it('renders Legal Notice link in English', () => {
    renderFooter('en');
    const link = screen.getByRole('link', { name: 'Legal Notice' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/pages/legal');
  });
});
