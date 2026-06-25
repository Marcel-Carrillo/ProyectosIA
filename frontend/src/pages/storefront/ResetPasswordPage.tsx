import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resetPassword } from '../../services/customerAuthService';
import StorefrontAuthPanel from '../../components/storefront/StorefrontAuthPanel';

const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation('auth');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError(t('resetPassword.missingToken'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      navigate('/login');
    } catch {
      setError(t('resetPassword.errorMessage'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StorefrontAuthPanel
      title={t('resetPassword.title')}
      subtitle={t('resetPassword.subtitle')}
      footer={
        <Link to="/login" className="storefront-auth__guest">
          {t('resetPassword.backToSignIn')}
        </Link>
      }
    >
      {error && <p className="storefront-auth__error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="storefront-auth__form">
        <label className="storefront-field">
          <span className="storefront-field__label">{t('resetPassword.newPassword')}</span>
          <input
            type="password"
            className="storefront-field__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <button type="submit" className="storefront-btn storefront-btn--primary" disabled={submitting}>
          {submitting ? t('resetPassword.updating') : t('resetPassword.submit')}
        </button>
      </form>
    </StorefrontAuthPanel>
  );
};

export default ResetPasswordPage;
