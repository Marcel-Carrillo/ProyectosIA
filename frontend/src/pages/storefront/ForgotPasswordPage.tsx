import React, { useState } from 'react';
import { Alert, Button, Card, Container, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../services/customerAuthService';

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
    <Container className="py-4" style={{ maxWidth: 480 }}>
      <Card>
        <Card.Body>
          <h1 className="h4 mb-3">Forgot password</h1>
          {sent ? (
            <Alert variant="success">
              If an account exists for that email, we sent reset instructions.
            </Alert>
          ) : (
            <Form onSubmit={handleSubmit}>
              {error && <Alert variant="danger">{error}</Alert>}
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Form.Group>
              <Button type="submit" className="w-100" disabled={submitting}>Send reset link</Button>
            </Form>
          )}
          <div className="small mt-3"><Link to="/login">Back to sign in</Link></div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default ForgotPasswordPage;
