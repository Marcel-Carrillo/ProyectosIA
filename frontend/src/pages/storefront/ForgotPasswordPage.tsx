import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../services/customerAuthService';
import StorefrontAuthPanel from '../../components/storefront/StorefrontAuthPanel';

const ForgotPasswordPage: React.FC = () => {
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
      setError('Could not send reset email. Try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StorefrontAuthPanel
      title="Forgot password"
      subtitle={sent ? undefined : 'We will email you a reset link.'}
      footer={
        <Link to="/login" className="storefront-auth__guest">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p className="storefront-auth__info">
          If an account exists for that email, we sent reset instructions.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="storefront-auth__form">
          {error && <p className="storefront-auth__error" role="alert">{error}</p>}
          <label className="storefront-field">
            <span className="storefront-field__label">Email</span>
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
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </StorefrontAuthPanel>
  );
};

export default ForgotPasswordPage;
