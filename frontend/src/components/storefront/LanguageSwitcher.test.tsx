import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../test-utils/renderWithI18n';
import LanguageSwitcher from './LanguageSwitcher';

describe('LanguageSwitcher', () => {
  it('renders both flag buttons', () => {
    renderWithI18n(<LanguageSwitcher />);
    expect(screen.getByLabelText('Español')).toBeInTheDocument();
    expect(screen.getByLabelText('English')).toBeInTheDocument();
  });

  it('shows English as active when lng is en', () => {
    renderWithI18n(<LanguageSwitcher />, { lng: 'en' });
    expect(screen.getByLabelText('English')).toHaveClass('storefront-lang-switcher__btn--active');
    expect(screen.getByLabelText('Español')).not.toHaveClass('storefront-lang-switcher__btn--active');
  });

  it('shows Spanish as active when lng is es', () => {
    renderWithI18n(<LanguageSwitcher />, { lng: 'es' });
    expect(screen.getByLabelText('Español')).toHaveClass('storefront-lang-switcher__btn--active');
    expect(screen.getByLabelText('English')).not.toHaveClass('storefront-lang-switcher__btn--active');
  });

  it('has correct aria-pressed attributes', () => {
    renderWithI18n(<LanguageSwitcher />, { lng: 'en' });
    expect(screen.getByLabelText('English')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Español')).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking the inactive language button changes language', () => {
    renderWithI18n(<LanguageSwitcher />, { lng: 'en' });
    fireEvent.click(screen.getByLabelText('Español'));
    expect(screen.getByLabelText('Español')).toHaveClass('storefront-lang-switcher__btn--active');
  });
});
