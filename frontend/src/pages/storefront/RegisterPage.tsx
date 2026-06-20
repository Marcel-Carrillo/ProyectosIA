import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { extractCustomerAuthError } from '../../services/customerAuthService';
import OAuthButtons from '../../components/storefront/OAuthButtons';
import StorefrontAuthPanel from '../../components/storefront/StorefrontAuthPanel';

const FIELD_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Phone',
  password: 'Password',
};

const RegisterPage: React.FC = () => {
  const { register } = useCustomerAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      title="Create account"
      subtitle="Join Mavile in a minute."
      footer={
        <Link to="/login" className="storefront-auth__guest">
          Already have an account? Sign in
        </Link>
      }
    >
      {error && <p className="storefront-auth__error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="storefront-auth__form">
        {(['firstName', 'lastName', 'email', 'phone', 'password'] as const).map((field) => (
          <label className="storefront-field" key={field}>
            <span className="storefront-field__label">{FIELD_LABELS[field]}</span>
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
          {submitting ? 'Creating account…' : 'Register'}
        </button>
        <OAuthButtons />
      </form>
    </StorefrontAuthPanel>
  );
};

export default RegisterPage;
