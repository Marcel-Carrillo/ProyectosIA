import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

type OAuthProviders = {
  google: boolean;
  apple: boolean;
  facebook: boolean;
};

const defaultProviders: OAuthProviders = {
  google: false,
  apple: false,
  facebook: false,
};

/** Official multicolor Google "G" mark for sign-in affordance. */
const GoogleIcon: React.FC = () => (
  <svg className="storefront-oauth__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const AppleIcon: React.FC = () => (
  <svg className="storefront-oauth__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M16.365 1.43c0 1.14-.415 2.206-1.244 3.05-.906.94-2.227 1.637-3.397 1.54-.15-1.103.39-2.27 1.2-3.075C13.84 1.98 15.2 1.3 16.365 1.43zm3.29 16.63c-.66 1.52-1.455 2.94-2.59 2.96-1.12.03-1.48-.74-2.76-.74-1.28 0-1.68.72-2.74.76-1.1.04-1.94-1.42-2.61-2.93-1.35-3.08-.345-7.63 1.9-10.13.99-1.12 2.32-1.85 3.66-1.87 1.14-.02 2.22.77 2.76.77.53 0 1.9-.95 3.2-.81.545.02 2.08.22 3.06 1.66-.08.05-1.83 1.07-1.81 3.19.03 2.53 2.22 3.37 2.25 3.39-.02.07-.35 1.2-1.16 2.37z"
    />
  </svg>
);

const FacebookIcon: React.FC = () => (
  <svg className="storefront-oauth__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="#1877F2"
      d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.491 0-1.956.93-1.956 1.886v2.263h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
    />
  </svg>
);

const OAuthButtons: React.FC = () => {
  const [providers, setProviders] = useState<OAuthProviders>(defaultProviders);
  const { t } = useTranslation('common');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/public/auth/oauth/providers`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body?.data) {
          setProviders(body.data as OAuthProviders);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const anyEnabled = providers.google || providers.apple || providers.facebook;
  if (!anyEnabled) {
    return null;
  }

  return (
    <div className="storefront-oauth">
      <p className="storefront-oauth__separator">{t('oauth.separator')}</p>
      <div className="storefront-oauth__actions">
        {providers.google && (
          <button
            type="button"
            className="storefront-oauth__icon-btn storefront-oauth__icon-btn--google"
            aria-label={t('oauth.google')}
            title={t('oauth.google')}
            data-testid="oauth-google"
            onClick={() => {
              window.location.href = `${API_BASE}/api/public/auth/google`;
            }}
          >
            <GoogleIcon />
          </button>
        )}
        {providers.apple && (
          <button
            type="button"
            className="storefront-oauth__icon-btn storefront-oauth__icon-btn--apple"
            aria-label={t('oauth.apple')}
            title={t('oauth.apple')}
            data-testid="oauth-apple"
            onClick={() => {
              window.location.href = `${API_BASE}/api/public/auth/apple`;
            }}
          >
            <AppleIcon />
          </button>
        )}
        {providers.facebook && (
          <button
            type="button"
            className="storefront-oauth__icon-btn storefront-oauth__icon-btn--facebook"
            aria-label={t('oauth.facebook')}
            title={t('oauth.facebook')}
            data-testid="oauth-facebook"
            onClick={() => {
              window.location.href = `${API_BASE}/api/public/auth/facebook`;
            }}
          >
            <FacebookIcon />
          </button>
        )}
      </div>
    </div>
  );
};

export default OAuthButtons;
