import React, { useState } from 'react';
import { Alert, Button, Card, Container, Form } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { extractCustomerAuthError } from '../../services/customerAuthService';
import OAuthButtons from '../../components/storefront/OAuthButtons';

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
    <Container className="py-4" style={{ maxWidth: 480 }}>
      <Card>
        <Card.Body>
          <h1 className="h4 mb-3">Create account</h1>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            {(['firstName', 'lastName', 'email', 'phone', 'password'] as const).map((field) => (
              <Form.Group className="mb-3" key={field}>
                <Form.Label>{field === 'firstName' ? 'First name' : field === 'lastName' ? 'Last name' : field.charAt(0).toUpperCase() + field.slice(1)}</Form.Label>
                <Form.Control
                  type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  required={field !== 'phone'}
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                />
              </Form.Group>
            ))}
            <Button type="submit" className="w-100 mb-2" disabled={submitting}>Register</Button>
            <div className="small"><Link to="/login">Already have an account?</Link></div>
            <OAuthButtons />
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default RegisterPage;
