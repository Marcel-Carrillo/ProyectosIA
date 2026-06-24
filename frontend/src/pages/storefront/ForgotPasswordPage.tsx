import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { forgotPassword } from '../../services/customerAuthService';
import StorefrontAuthPanel from '../../components/storefront/StorefrontAuthPanel';

const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch {
      setError(t('forgotPassword.errorMessage'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StorefrontAuthPanel
      title={t('forgotPassword.title')}
      subtitle={sent ? undefined : t('forgotPassword.subtitle')}
      footer={
        <Link to="/login" className="storefront-auth__guest">
          {t('forgotPassword.backToSignIn')}
        </Link>
      }
    >
      {sent ? (
        <p className="storefront-auth__info">
          {t('forgotPassword.successMessage')}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="storefront-auth__form">
          {error && <p className="storefront-auth__error" role="alert">{error}</p>}
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
          <button type="submit" className="storefront-btn storefront-btn--primary" disabled={submitting}>
            {submitting ? t('forgotPassword.sending') : t('forgotPassword.submit')}
          </button>
        </form>
      )}
    </StorefrontAuthPanel>
  );
};

export default ForgotPasswordPage;
