import React, { useEffect, useState } from 'react';
import { Modal, Form, Button, Alert, Row, Col } from 'react-bootstrap';
import {
  customerService,
  extractCustomerErrorMessage,
} from '../../services/customerService';
import {
  CustomerAddress,
  AddressType,
  CreateCustomerAddressInput,
  UpdateCustomerAddressInput,
} from '../../types/customer';

type CustomerAddressFormModalProps = {
  show: boolean;
  onHide: () => void;
  customerId: number;
  onSuccess: (address: CustomerAddress) => void;
  initial?: CustomerAddress;
};

type FormData = {
  type: AddressType;
  fullName: string;
  phone: string;
  streetLine1: string;
  streetLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

const EMPTY: FormData = {
  type: 'Shipping',
  fullName: '',
  phone: '',
  streetLine1: '',
  streetLine2: '',
  city: '',
  province: '',
  postalCode: '',
  country: '',
};

const CustomerAddressFormModal: React.FC<CustomerAddressFormModalProps> = ({
  show,
  onHide,
  customerId,
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
          type: initial.type,
          fullName: initial.fullName,
          phone: initial.phone ?? '',
          streetLine1: initial.streetLine1,
          streetLine2: initial.streetLine2 ?? '',
          city: initial.city,
          province: initial.province,
          postalCode: initial.postalCode,
          country: initial.country,
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
    if (!formData.fullName.trim()) return 'Full name is required.';
    if (formData.fullName.length > 150) return 'Full name must not exceed 150 characters.';
    if (!formData.streetLine1.trim()) return 'Street line 1 is required.';
    if (formData.streetLine1.length > 150) return 'Street line 1 must not exceed 150 characters.';
    if (formData.streetLine2 && formData.streetLine2.length > 150)
      return 'Street line 2 must not exceed 150 characters.';
    if (!formData.city.trim()) return 'City is required.';
    if (formData.city.length > 100) return 'City must not exceed 100 characters.';
    if (!formData.province.trim()) return 'Province is required.';
    if (formData.province.length > 100) return 'Province must not exceed 100 characters.';
    if (!formData.postalCode.trim()) return 'Postal code is required.';
    if (formData.postalCode.length > 20) return 'Postal code must not exceed 20 characters.';
    if (!formData.country.trim()) return 'Country is required.';
    if (formData.country.length > 100) return 'Country must not exceed 100 characters.';
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
        const payload: UpdateCustomerAddressInput = {
          type: formData.type,
          fullName: formData.fullName.trim(),
          phone: formData.phone || null,
          streetLine1: formData.streetLine1.trim(),
          streetLine2: formData.streetLine2 || null,
          city: formData.city.trim(),
          province: formData.province.trim(),
          postalCode: formData.postalCode.trim(),
          country: formData.country.trim(),
        };
        res = await customerService.updateAddress(customerId, initial.id, payload);
      } else {
        const payload: CreateCustomerAddressInput = {
          type: formData.type,
          fullName: formData.fullName.trim(),
          phone: formData.phone || null,
          streetLine1: formData.streetLine1.trim(),
          streetLine2: formData.streetLine2 || null,
          city: formData.city.trim(),
          province: formData.province.trim(),
          postalCode: formData.postalCode.trim(),
          country: formData.country.trim(),
        };
        res = await customerService.createAddress(customerId, payload);
      }
      onSuccess(res.data);
    } catch (err) {
      setError(extractCustomerErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      fullscreen="sm-down"
      data-testid="modal-customer-address-form"
    >
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>{initial ? 'Edit address' : 'New address'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>Type *</Form.Label>
            <Form.Select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value as AddressType)}
              data-testid="select-address-type"
            >
              <option value="Shipping">Shipping</option>
              <option value="Billing">Billing</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Full name *</Form.Label>
            <Form.Control
              type="text"
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              data-testid="input-address-full-name"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Phone</Form.Label>
            <Form.Control
              type="text"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              data-testid="input-address-phone"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Street line 1 *</Form.Label>
            <Form.Control
              type="text"
              value={formData.streetLine1}
              onChange={(e) => handleChange('streetLine1', e.target.value)}
              data-testid="input-address-street-line-1"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Street line 2</Form.Label>
            <Form.Control
              type="text"
              value={formData.streetLine2}
              onChange={(e) => handleChange('streetLine2', e.target.value)}
              data-testid="input-address-street-line-2"
            />
          </Form.Group>

          <Row>
            <Col xs={12} md={6}>
              <Form.Group className="mb-3">
                <Form.Label>City *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  data-testid="input-address-city"
                />
              </Form.Group>
            </Col>
            <Col xs={12} md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Province *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.province}
                  onChange={(e) => handleChange('province', e.target.value)}
                  data-testid="input-address-province"
                />
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col xs={12} md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Postal code *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => handleChange('postalCode', e.target.value)}
                  data-testid="input-address-postal-code"
                />
              </Form.Group>
            </Col>
            <Col xs={12} md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Country *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  data-testid="input-address-country"
                />
              </Form.Group>
            </Col>
          </Row>
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
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add address'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default CustomerAddressFormModal;
