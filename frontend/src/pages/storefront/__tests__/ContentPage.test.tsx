import React from 'react';
import { screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ContentPage from '../ContentPage';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';

function renderContentPage(slug: string, lng: 'es' | 'en' = 'es') {
  return renderWithI18n(
    <MemoryRouter initialEntries={[`/pages/${slug}`]}>
      <Routes>
        <Route path="/pages/:slug" element={<ContentPage />} />
        <Route path="/catalog" element={<div data-testid="catalog-page" />} />
      </Routes>
    </MemoryRouter>,
    { lng },
  );
}

describe('ContentPage — legal slugs', () => {
  it('renders Privacy Policy page in Spanish', () => {
    renderContentPage('privacy', 'es');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Política de Privacidad');
    expect(screen.getByRole('heading', { name: /responsable del tratamiento/i })).toBeInTheDocument();
  });

  it('renders Legal Notice page in Spanish', () => {
    renderContentPage('legal', 'es');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aviso Legal');
    expect(screen.getByRole('heading', { name: /datos del titular/i })).toBeInTheDocument();
  });

  it('renders Privacy Policy page in English', () => {
    renderContentPage('privacy', 'en');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy Policy');
    expect(screen.getByRole('heading', { name: /data controller/i })).toBeInTheDocument();
  });

  it('renders Legal Notice page in English', () => {
    renderContentPage('legal', 'en');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Legal Notice');
    expect(screen.getByRole('heading', { name: /company details/i })).toBeInTheDocument();
  });

  it('redirects unknown slug to /catalog', () => {
    renderContentPage('unknown-slug', 'es');
    expect(screen.getByTestId('catalog-page')).toBeInTheDocument();
  });
});
