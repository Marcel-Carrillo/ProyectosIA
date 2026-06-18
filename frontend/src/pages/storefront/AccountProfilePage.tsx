import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Container, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { getProfile, updateProfile } from '../../services/customerAuthService';
import { CustomerProfile } from '../../types/auth';

const AccountProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p);
      setFirstName(p.firstName);
      setLastName(p.lastName);
      setPhone(p.phone ?? '');
    }).catch(() => setError('Could not load profile.'));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const updated = await updateProfile({ firstName, lastName, phone });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Could not save profile.');
    }
  };

  return (
    <Container className="py-4" style={{ maxWidth: 560 }}>
      <p className="mb-3"><Link to="/account">← My account</Link></p>
      <Card>
        <Card.Body>
          <h1 className="h4 mb-3">Profile</h1>
          {error && <Alert variant="danger">{error}</Alert>}
          {saved && <Alert variant="success">Profile updated.</Alert>}
          {profile && (
            <Form onSubmit={handleSave}>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control value={profile.email} disabled readOnly />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>First name</Form.Label>
                <Form.Control value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Last name</Form.Label>
                <Form.Control value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Phone</Form.Label>
                <Form.Control value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Form.Group>
              <Button type="submit">Save changes</Button>
            </Form>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default AccountProfilePage;
