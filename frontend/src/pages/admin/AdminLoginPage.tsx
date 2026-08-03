import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Container, Form } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { extractAuthError } from '../../services/adminAuthService';
import Seo from '../../components/storefront/Seo';
import i18n from '../../i18n';

const AdminLoginPage: React.FC = () => {
  const { login, verify2fa } = useAdminAuth();

  useEffect(() => {
    void i18n.changeLanguage('es');
  }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/products';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (result?.mfaRequired) {
        setMfaToken(result.mfaToken);
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(extractAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;
    setError('');
    setSubmitting(true);
    try {
      await verify2fa(mfaToken, otpCode);
      navigate(from, { replace: true });
    } catch (err) {
      setError(extractAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container className="py-5" style={{ maxWidth: 420 }}>
      <Seo title="Inicio de sesión admin | Mavile" noindex />
      <Card>
        <Card.Body>
          <h1 className="h4 mb-3">
            {mfaToken ? 'Verificación en dos pasos' : 'Inicio de sesión de administración'}
          </h1>
          {error && <Alert variant="danger">{error}</Alert>}

          {mfaToken ? (
            <Form onSubmit={handleVerify} data-testid="admin-otp-form">
              <Alert variant="light" className="border small">
                Hemos enviado un código de 6 dígitos a tu correo. En local, revísalo en Mailpit
                (http://localhost:8025).
              </Alert>
              <Form.Group className="mb-3" controlId="admin-otp">
                <Form.Label>Código de verificación</Form.Label>
                <Form.Control
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  minLength={6}
                  maxLength={6}
                  data-testid="input-admin-otp"
                />
              </Form.Group>
              <Button type="submit" variant="dark" className="w-100" disabled={submitting || otpCode.length !== 6}>
                {submitting ? 'Verificando…' : 'Verificar e iniciar sesión'}
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-100 mt-2"
                disabled={submitting}
                onClick={() => {
                  setMfaToken(null);
                  setOtpCode('');
                  setError('');
                }}
              >
                Volver al inicio de sesión
              </Button>
            </Form>
          ) : (
            <Form onSubmit={handleSubmit} data-testid="admin-login-form">
              <Form.Group className="mb-3" controlId="admin-email">
                <Form.Label>Correo electrónico</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  data-testid="input-admin-email"
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="admin-password">
                <Form.Label>Contraseña</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  data-testid="input-admin-password"
                />
              </Form.Group>
              <Button type="submit" variant="dark" className="w-100" disabled={submitting}>
                {submitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
              </Button>
            </Form>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default AdminLoginPage;
