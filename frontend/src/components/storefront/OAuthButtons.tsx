import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const API_BASE = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';

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
      {providers.google && (
        <button
          type="button"
          className="storefront-oauth__btn"
          onClick={() => { window.location.href = `${API_BASE}/api/public/auth/google`; }}
        >
          {t('oauth.google')}
        </button>
      )}
      {providers.apple && (
        <button
          type="button"
          className="storefront-oauth__btn"
          onClick={() => { window.location.href = `${API_BASE}/api/public/auth/apple`; }}
        >
          {t('oauth.apple')}
        </button>
      )}
      {providers.facebook && (
        <button
          type="button"
          className="storefront-oauth__btn"
          onClick={() => { window.location.href = `${API_BASE}/api/public/auth/facebook`; }}
        >
          {t('oauth.facebook')}
        </button>
      )}
    </div>
  );
};

export default OAuthButtons;
