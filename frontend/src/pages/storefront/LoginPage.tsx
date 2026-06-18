import React, { useState } from 'react';
import { Alert, Button, Card, Container, Form } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { extractCustomerAuthError } from '../../services/customerAuthService';
import OAuthButtons from '../../components/storefront/OAuthButtons';

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

  return (
    <Container className="py-4" style={{ maxWidth: 480 }}>
      <Card>
        <Card.Body>
          <h1 className="h4 mb-3">{mfaToken ? 'Two-factor authentication' : 'Sign in'}</h1>
          {error && <Alert variant="danger">{error}</Alert>}
          {mfaToken ? (
            <Form onSubmit={handle2fa}>
              <Form.Group className="mb-3">
                <Form.Label>Authentication code</Form.Label>
                <Form.Control value={totpCode} onChange={(e) => setTotpCode(e.target.value)} required />
              </Form.Group>
              <Button type="submit" disabled={submitting}>Verify</Button>
            </Form>
          ) : (
            <Form onSubmit={handleLogin}>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </Form.Group>
              <Button type="submit" className="w-100 mb-2" disabled={submitting}>Sign in</Button>
              <div className="small">
                <Link to="/register">Create account</Link> · <Link to="/forgot-password">Forgot password?</Link>
              </div>
              <OAuthButtons />
            </Form>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default LoginPage;
