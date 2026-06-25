import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { extractCustomerAuthError } from '../../services/customerAuthService';
import OAuthButtons from '../../components/storefront/OAuthButtons';
import StorefrontAuthPanel from '../../components/storefront/StorefrontAuthPanel';

const RegisterPage: React.FC = () => {
  const { register } = useCustomerAuth();
  const navigate = useNavigate();
  const { t } = useTranslation('auth');
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fieldLabels: Record<string, string> = {
    firstName: t('fields.firstName'),
    lastName: t('fields.lastName'),
    email: t('fields.email'),
    phone: t('fields.phone'),
    password: t('fields.password'),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
      });
      navigate('/account');
    } catch (err) {
      setError(extractCustomerAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StorefrontAuthPanel
      title={t('register.title')}
      subtitle={t('register.subtitle')}
      footer={
        <Link to="/login" className="storefront-auth__guest">
          {t('register.alreadyHaveAccount')}
        </Link>
      }
    >
      {error && <p className="storefront-auth__error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="storefront-auth__form">
        {(['firstName', 'lastName', 'email', 'phone', 'password'] as const).map((field) => (
          <label className="storefront-field" key={field}>
            <span className="storefront-field__label">{fieldLabels[field]}</span>
            <input
              type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
              className="storefront-field__input"
              required={field !== 'phone'}
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              autoComplete={field === 'password' ? 'new-password' : field}
            />
          </label>
        ))}
        <button type="submit" className="storefront-btn storefront-btn--primary" disabled={submitting}>
          {submitting ? t('register.creating') : t('register.submit')}
        </button>
        <OAuthButtons />
      </form>
    </StorefrontAuthPanel>
  );
};

export default RegisterPage;
