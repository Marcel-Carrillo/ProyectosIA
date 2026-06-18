import React, { useState } from 'react';
import { Alert, Button, Card, Container, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { getCustomerAccessToken } from '../../services/customerAuthService';

const API_BASE = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';

const TwoFactorSetupPage: React.FC = () => {
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');

  const headers = () => {
    const token = getCustomerAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const startSetup = async () => {
    setError('');
    try {
      const res = await axios.post<{ data: { secret: string; otpauthUrl?: string } }>(
        `${API_BASE}/api/public/account/security/2fa/setup`,
        {},
        { headers: headers() }
      );
      setSecret(res.data.data.secret);
      setOtpauthUrl(res.data.data.otpauthUrl ?? null);
    } catch {
      setError('Could not start 2FA setup.');
    }
  };

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await axios.post(
        `${API_BASE}/api/public/account/security/2fa/confirm`,
        { code },
        { headers: headers() }
      );
      setEnabled(true);
    } catch {
      setError('Invalid code. Try again.');
    }
  };

  return (
    <Container className="py-4" style={{ maxWidth: 560 }}>
      <p className="mb-3"><Link to="/account">← My account</Link></p>
      <Card>
        <Card.Body>
          <h1 className="h4 mb-3">Two-factor authentication</h1>
          {error && <Alert variant="danger">{error}</Alert>}
          {enabled ? (
            <Alert variant="success">2FA is now enabled on your account.</Alert>
          ) : !secret ? (
            <Button onClick={startSetup}>Start setup</Button>
          ) : (
            <>
              <p className="small text-muted">Add this secret to your authenticator app:</p>
              <code className="d-block mb-2">{secret}</code>
              {otpauthUrl && <p className="small text-break">{otpauthUrl}</p>}
              <Form onSubmit={confirmSetup}>
                <Form.Group className="mb-3">
                  <Form.Label>Verification code</Form.Label>
                  <Form.Control value={code} onChange={(e) => setCode(e.target.value)} required />
                </Form.Group>
                <Button type="submit">Confirm 2FA</Button>
              </Form>
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default TwoFactorSetupPage;
