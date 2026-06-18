import React, { useEffect, useState } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import {
  customerService,
  extractCustomerErrorMessage,
} from '../../services/customerService';
import {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from '../../types/customer';

type CustomerFormModalProps = {
  show: boolean;
  onHide: () => void;
  onSuccess: (customer: Customer) => void;
  initial?: Customer;
};

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

const EMPTY: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  show,
  onHide,
  onSuccess,
  initial,
}) => {
  const [formData, setFormData] = useState<FormData>(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) {
      if (initial) {
        setFormData({
          firstName: initial.firstName,
          lastName: initial.lastName,
          email: initial.email,
          phone: initial.phone ?? '',
        });
      } else {
        setFormData(EMPTY);
      }
      setError('');
    }
  }, [show, initial]);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validate = (): string | null => {
    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    const email = formData.email.trim();

    if (!firstName) return 'First name is required.';
    if (firstName.length > 100) return 'First name must not exceed 100 characters.';
    if (!lastName) return 'Last name is required.';
    if (lastName.length > 100) return 'Last name must not exceed 100 characters.';
    if (!email) return 'Email is required.';
    if (!EMAIL_REGEX.test(email)) return 'Email must be a valid email address.';
    if (email.length > 255) return 'Email must not exceed 255 characters.';
    if (formData.phone && formData.phone.length > 30)
      return 'Phone must not exceed 30 characters.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      let res;
      if (initial) {
        const payload: UpdateCustomerInput = {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone || null,
        };
        res = await customerService.update(initial.id, payload);
      } else {
        const payload: CreateCustomerInput = {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone || null,
        };
        res = await customerService.create(payload);
      }
      onSuccess(res.data);
    } catch (err) {
      setError(extractCustomerErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} fullscreen="sm-down" data-testid="modal-customer-form">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>{initial ? 'Edit customer' : 'New customer'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>First name *</Form.Label>
            <Form.Control
              type="text"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              data-testid="input-customer-first-name"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Last name *</Form.Label>
            <Form.Control
              type="text"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              data-testid="input-customer-last-name"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Email *</Form.Label>
            <Form.Control
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              data-testid="input-customer-email"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Phone</Form.Label>
            <Form.Control
              type="text"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              data-testid="input-customer-phone"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} data-testid="btn-modal-cancel">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
            data-testid="btn-modal-save"
          >
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default CustomerFormModal;
