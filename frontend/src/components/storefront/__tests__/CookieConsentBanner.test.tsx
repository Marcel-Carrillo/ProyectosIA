import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { CookieConsentProvider } from '../../../contexts/CookieConsentContext';
import CookieConsentBanner from '../CookieConsentBanner';
import CookiePreferencesModal from '../CookiePreferencesModal';
import { CONSENT_STORAGE_KEY, CONSENT_VERSION } from '../../../constants/cookieConsent';

const renderBanner = (lng: 'es' | 'en' = 'en') =>
  renderWithI18n(
    <MemoryRouter>
      <CookieConsentProvider>
        <CookieConsentBanner />
        <CookiePreferencesModal />
      </CookieConsentProvider>
    </MemoryRouter>,
    { lng }
  );

describe('CookieConsentBanner', () => {
  beforeEach(() => localStorage.clear());

  it('renders when no consent decision exists', async () => {
    renderBanner();
    expect(await screen.findByTestId('cookie-consent-banner')).toBeInTheDocument();
  });

  it('does not render when valid consent exists', async () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      categories: { necessary: true, analytics: false, marketing: false },
    }));
    renderBanner();
    await expect(
      screen.findByTestId('cookie-consent-banner', {}, { timeout: 200 })
    ).rejects.toThrow();
  });

  it('"Accept all" saves all categories as true', async () => {
    renderBanner();
    fireEvent.click(await screen.findByTestId('cookie-banner-accept'));
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored.categories).toEqual({ necessary: true, analytics: true, marketing: true });
  });

  it('"Reject all" saves analytics and marketing as false', async () => {
    renderBanner();
    fireEvent.click(await screen.findByTestId('cookie-banner-reject'));
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored.categories).toEqual({ necessary: true, analytics: false, marketing: false });
  });

  it('"Customize" opens the preferences modal', async () => {
    renderBanner();
    fireEvent.click(await screen.findByTestId('cookie-banner-customize'));
    expect(await screen.findByTestId('cookie-modal-overlay')).toBeInTheDocument();
  });
});
