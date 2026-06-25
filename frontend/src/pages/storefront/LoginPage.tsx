import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { extractCustomerAuthError } from '../../services/customerAuthService';
import OAuthButtons from '../../components/storefront/OAuthButtons';
import StorefrontAuthPanel from '../../components/storefront/StorefrontAuthPanel';

const LoginPage: React.FC = () => {
  const { login, verify2fa } = useCustomerAuth();
  const navigate = useNavigate();
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.mfaRequired && result.mfaToken) {
        setMfaToken(result.mfaToken);
      } else {
        navigate('/account');
      }
    } catch (err) {
      setError(extractCustomerAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handle2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;
    setError('');
    setSubmitting(true);
    try {
      await verify2fa(mfaToken, totpCode);
      navigate('/account');
    } catch {
      setError(t('login.invalidCode'));
    } finally {
      setSubmitting(false);
    }
  };

  const title = mfaToken ? t('login.titleMfa') : t('login.title');
  const subtitle = mfaToken ? t('login.subtitleMfa') : t('login.subtitle');

  return (
    <StorefrontAuthPanel
      title={title}
      subtitle={subtitle}
      footer={
        <>
          {!mfaToken && (
            <div className="storefront-auth__links">
              <Link to="/register">{t('login.createAccount')}</Link>
              <Link to="/forgot-password">{t('login.forgotPassword')}</Link>
            </div>
          )}
          <Link to="/catalog" className="storefront-auth__guest">
            {t('login.continueAsGuest')}
          </Link>
        </>
      }
    >
      {error && <p className="storefront-auth__error" role="alert">{error}</p>}
      {mfaToken ? (
        <form onSubmit={handle2fa} className="storefront-auth__form">
          <label className="storefront-field">
            <span className="storefront-field__label">{t('login.authCode')}</span>
            <input
              className="storefront-field__input"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              required
              autoComplete="one-time-code"
            />
          </label>
          <button type="submit" className="storefront-btn storefront-btn--primary" disabled={submitting}>
            {submitting ? t('login.verifying') : t('login.verify')}
          </button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="storefront-auth__form">
          <label className="storefront-field">
            <span className="storefront-field__label">{t('fields.email')}</span>
            <input
              type="email"
              className="storefront-field__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="storefront-field">
            <span className="storefront-field__label">{t('fields.password')}</span>
            <input
              type="password"
              className="storefront-field__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button type="submit" className="storefront-btn storefront-btn--primary" disabled={submitting}>
            {submitting ? t('login.signingIn') : t('login.submit')}
          </button>
          <OAuthButtons />
        </form>
      )}
    </StorefrontAuthPanel>
  );
};

export default LoginPage;
