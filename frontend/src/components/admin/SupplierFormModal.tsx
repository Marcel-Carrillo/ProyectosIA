import React, { useEffect, useState } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { supplierService, extractSupplierErrorMessage } from '../../services/supplierService';
import {
  Supplier,
  SupplierStatus,
  CreateSupplierInput,
  UpdateSupplierInput,
} from '../../types/supplier';

type SupplierFormModalProps = {
  show: boolean;
  onHide: () => void;
  onSuccess: (supplier: Supplier) => void;
  initial?: Supplier; // undefined = create mode; Supplier = edit mode
};

type FormData = {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  notes: string;
  status: SupplierStatus;
};

const EMPTY: FormData = {
  name: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
  notes: '',
  status: 'Active',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SupplierFormModal: React.FC<SupplierFormModalProps> = ({ show, onHide, onSuccess, initial }) => {
  const [formData, setFormData] = useState<FormData>(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) {
      if (initial) {
        setFormData({
          name: initial.name,
          contactName: initial.contactName ?? '',
          contactEmail: initial.contactEmail ?? '',
          contactPhone: initial.contactPhone ?? '',
          website: initial.website ?? '',
          notes: initial.notes ?? '',
          status: initial.status,
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
    const name = formData.name.trim();
    if (!name) return 'Name is required.';
    if (name.length > 150) return 'Name must not exceed 150 characters.';
    if (formData.contactName && formData.contactName.length > 150)
      return 'Contact name must not exceed 150 characters.';
    if (formData.contactEmail) {
      if (!EMAIL_REGEX.test(formData.contactEmail))
        return 'Contact email must be a valid email address.';
      if (formData.contactEmail.length > 255)
        return 'Contact email must not exceed 255 characters.';
    }
    if (formData.contactPhone && formData.contactPhone.length > 30)
      return 'Contact phone must not exceed 30 characters.';
    if (formData.website && formData.website.length > 500)
      return 'Website must not exceed 500 characters.';
    if (formData.notes && formData.notes.length > 2000)
      return 'Notes must not exceed 2000 characters.';
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
        const payload: UpdateSupplierInput = {
          name: formData.name.trim(),
          contactName: formData.contactName || null,
          contactEmail: formData.contactEmail || null,
          contactPhone: formData.contactPhone || null,
          website: formData.website || null,
          notes: formData.notes || null,
          status: formData.status,
        };
        res = await supplierService.update(initial.id, payload);
      } else {
        const payload: CreateSupplierInput = {
          name: formData.name.trim(),
          contactName: formData.contactName || null,
          contactEmail: formData.contactEmail || null,
          contactPhone: formData.contactPhone || null,
          website: formData.website || null,
          notes: formData.notes || null,
        };
        res = await supplierService.create(payload);
      }
      onSuccess(res.data);
    } catch (err) {
      setError(extractSupplierErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} fullscreen="sm-down" data-testid="modal-supplier-form">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>{initial ? 'Edit supplier' : 'New supplier'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>Name *</Form.Label>
            <Form.Control
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              data-testid="input-supplier-name"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Contact name</Form.Label>
            <Form.Control
              type="text"
              value={formData.contactName}
              onChange={(e) => handleChange('contactName', e.target.value)}
              data-testid="input-supplier-contact-name"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Contact email</Form.Label>
            <Form.Control
              type="email"
              value={formData.contactEmail}
              onChange={(e) => handleChange('contactEmail', e.target.value)}
              data-testid="input-supplier-contact-email"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Contact phone</Form.Label>
            <Form.Control
              type="text"
              value={formData.contactPhone}
              onChange={(e) => handleChange('contactPhone', e.target.value)}
              data-testid="input-supplier-contact-phone"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Website</Form.Label>
            <Form.Control
              type="text"
              value={formData.website}
              onChange={(e) => handleChange('website', e.target.value)}
              data-testid="input-supplier-website"
            />
          </Form.Group>

          {initial && (
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value as SupplierStatus)}
                data-testid="select-supplier-status"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Blocked">Blocked</option>
              </Form.Select>
            </Form.Group>
          )}

          <Form.Group className="mb-3">
            <Form.Label>
              Notes <span className="text-muted">(internal)</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              data-testid="input-supplier-notes"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} data-testid="btn-modal-cancel">
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving} data-testid="btn-modal-save">
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default SupplierFormModal;
