import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { resetPassword } from '../../services/customerAuthService';
import StorefrontAuthPanel from '../../components/storefront/StorefrontAuthPanel';

const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Reset token is missing.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      navigate('/login');
    } catch {
      setError('Invalid or expired reset token.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StorefrontAuthPanel
      title="Reset password"
      subtitle="Choose a new password for your account."
      footer={
        <Link to="/login" className="storefront-auth__guest">
          Back to sign in
        </Link>
      }
    >
      {error && <p className="storefront-auth__error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="storefront-auth__form">
        <label className="storefront-field">
          <span className="storefront-field__label">New password</span>
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
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </StorefrontAuthPanel>
  );
};

export default ResetPasswordPage;
