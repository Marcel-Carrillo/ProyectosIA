import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import AccountLayout from '../../components/storefront/AccountLayout';
import { getCustomerAccessToken } from '../../services/customerAuthService';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';

const API_BASE = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';

const TwoFactorSetupPage: React.FC = () => {
  const { t } = useTranslation('account');
  const { account } = useCustomerAuth();
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [justEnabled, setJustEnabled] = useState(false);
  const [error, setError] = useState('');

  const headers = () => {
    const token = getCustomerAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const startSetup = async () => {
    setError('');
    try {
      const res = await axios.post<{ data: { secret: string; otpauthUrl?: string } }>(
        `${API_BASE}/api/public/account/security/2fa/setup`,
        {},
        { headers: headers() }
      );
      setSecret(res.data.data.secret);
      setOtpauthUrl(res.data.data.otpauthUrl ?? null);
    } catch {
      setError(t('security.errors.setup'));
    }
  };

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await axios.post(
        `${API_BASE}/api/public/account/security/2fa/confirm`,
        { code },
        { headers: headers() }
      );
      setJustEnabled(true);
    } catch {
      setError(t('security.errors.invalidCode'));
    }
  };

  return (
    <AccountLayout title={t('security.title')}>
      <div className="storefront-account__panel">
        <h2 className="storefront-account__panel-title">{t('security.panelTitle')}</h2>
        {error && <p className="storefront-account__alert storefront-account__alert--error" role="alert">{error}</p>}
        {(justEnabled || account?.totpEnabled) ? (
          <p className="storefront-account__alert storefront-account__alert--success" role="status">
            {t('security.enabled')}
          </p>
        ) : !secret ? (
          <>
            <p className="storefront-auth__info">{t('security.intro')}</p>
            <div className="storefront-account__form-actions" style={{ marginTop: 'var(--spacing-6)' }}>
              <button
                type="button"
                className="storefront-btn storefront-btn--primary storefront-btn--press"
                onClick={startSetup}
              >
                {t('security.startSetup')}
              </button>
            </div>
          </>
        ) : (
          <>
            {otpauthUrl ? (
              <>
                <p className="storefront-auth__info">{t('security.qrHint')}</p>
                <div className="storefront-account__qr">
                  <QRCodeSVG value={otpauthUrl} size={200} />
                </div>
                <p className="storefront-auth__info" style={{ marginTop: 'var(--spacing-6)' }}>{t('security.secretHint')}</p>
                <code className="storefront-account__secret">{secret}</code>
              </>
            ) : (
              <>
                <p className="storefront-auth__info">{t('security.secretHint')}</p>
                <code className="storefront-account__secret">{secret}</code>
              </>
            )}
            <form className="storefront-account__form" onSubmit={confirmSetup}>
              <label className="storefront-field">
                <span className="storefront-field__label">{t('security.verificationCode')}</span>
                <input
                  className="storefront-field__input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoComplete="one-time-code"
                />
              </label>
              <div className="storefront-account__form-actions">
                <button type="submit" className="storefront-btn storefront-btn--primary storefront-btn--press">
                  {t('security.confirm')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </AccountLayout>
  );
};

export default TwoFactorSetupPage;
