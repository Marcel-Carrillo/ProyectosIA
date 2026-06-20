import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { extractCustomerAuthError } from '../../services/customerAuthService';
import OAuthButtons from '../../components/storefront/OAuthButtons';
import StorefrontAuthPanel from '../../components/storefront/StorefrontAuthPanel';

const LoginPage: React.FC = () => {
  const { login, verify2fa } = useCustomerAuth();
  const navigate = useNavigate();
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
      setError('Invalid verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  const title = mfaToken ? 'Two-factor authentication' : 'Sign in';
  const subtitle = mfaToken
    ? 'Enter the code from your authenticator app.'
    : 'Access your orders and saved details.';

  return (
    <StorefrontAuthPanel
      title={title}
      subtitle={subtitle}
      footer={
        <>
          {!mfaToken && (
            <div className="storefront-auth__links">
              <Link to="/register">Create account</Link>
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
          )}
          <Link to="/catalog" className="storefront-auth__guest">
            Continue as guest
          </Link>
        </>
      }
    >
      {error && <p className="storefront-auth__error" role="alert">{error}</p>}
      {mfaToken ? (
        <form onSubmit={handle2fa} className="storefront-auth__form">
          <label className="storefront-field">
            <span className="storefront-field__label">Authentication code</span>
            <input
              className="storefront-field__input"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              required
              autoComplete="one-time-code"
            />
          </label>
          <button type="submit" className="storefront-btn storefront-btn--primary" disabled={submitting}>
            {submitting ? 'Verifying…' : 'Verify'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="storefront-auth__form">
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
          <label className="storefront-field">
            <span className="storefront-field__label">Password</span>
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
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <OAuthButtons />
        </form>
      )}
    </StorefrontAuthPanel>
  );
};

export default LoginPage;
