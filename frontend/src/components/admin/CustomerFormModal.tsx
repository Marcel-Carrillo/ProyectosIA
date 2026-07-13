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

    if (!firstName) return 'El nombre es obligatorio.';
    if (firstName.length > 100) return 'El nombre no debe superar los 100 caracteres.';
    if (!lastName) return 'Los apellidos son obligatorios.';
    if (lastName.length > 100) return 'Los apellidos no deben superar los 100 caracteres.';
    if (!email) return 'El correo electrónico es obligatorio.';
    if (!EMAIL_REGEX.test(email)) return 'El correo electrónico debe ser válido.';
    if (email.length > 255) return 'El correo electrónico no debe superar los 255 caracteres.';
    if (formData.phone && formData.phone.length > 30)
      return 'El teléfono no debe superar los 30 caracteres.';
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
          <Modal.Title>{initial ? 'Editar cliente' : 'Nuevo cliente'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>Nombre *</Form.Label>
            <Form.Control
              type="text"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              data-testid="input-customer-first-name"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Apellidos *</Form.Label>
            <Form.Control
              type="text"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              data-testid="input-customer-last-name"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Correo electrónico *</Form.Label>
            <Form.Control
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              data-testid="input-customer-email"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Teléfono</Form.Label>
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
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
            data-testid="btn-modal-save"
          >
            {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default CustomerFormModal;
