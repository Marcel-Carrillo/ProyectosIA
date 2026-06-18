import React, { useState } from 'react';
import { Alert, Button, Card, Container, Form } from 'react-bootstrap';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { resetPassword } from '../../services/customerAuthService';

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
    <Container className="py-4" style={{ maxWidth: 480 }}>
      <Card>
        <Card.Body>
          <h1 className="h4 mb-3">Reset password</h1>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>New password</Form.Label>
              <Form.Control type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </Form.Group>
            <Button type="submit" className="w-100" disabled={submitting}>Update password</Button>
          </Form>
          <div className="small mt-3"><Link to="/login">Back to sign in</Link></div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default ResetPasswordPage;
