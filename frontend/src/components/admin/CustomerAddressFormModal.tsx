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
import { adminStatusLabel } from '../../utils/adminStatusLabels';

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
    if (!formData.fullName.trim()) return 'El nombre completo es obligatorio.';
    if (formData.fullName.length > 150) return 'El nombre completo no debe superar los 150 caracteres.';
    if (!formData.streetLine1.trim()) return 'La línea 1 de la calle es obligatoria.';
    if (formData.streetLine1.length > 150) return 'La línea 1 de la calle no debe superar los 150 caracteres.';
    if (formData.streetLine2 && formData.streetLine2.length > 150)
      return 'La línea 2 de la calle no debe superar los 150 caracteres.';
    if (!formData.city.trim()) return 'La ciudad es obligatoria.';
    if (formData.city.length > 100) return 'La ciudad no debe superar los 100 caracteres.';
    if (!formData.province.trim()) return 'La provincia es obligatoria.';
    if (formData.province.length > 100) return 'La provincia no debe superar los 100 caracteres.';
    if (!formData.postalCode.trim()) return 'El código postal es obligatorio.';
    if (formData.postalCode.length > 20) return 'El código postal no debe superar los 20 caracteres.';
    if (!formData.country.trim()) return 'El país es obligatorio.';
    if (formData.country.length > 100) return 'El país no debe superar los 100 caracteres.';
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
          <Modal.Title>{initial ? 'Editar dirección' : 'Nueva dirección'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>Tipo *</Form.Label>
            <Form.Select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value as AddressType)}
              data-testid="select-address-type"
            >
              <option value="Shipping">{adminStatusLabel('Shipping')}</option>
              <option value="Billing">{adminStatusLabel('Billing')}</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Nombre completo *</Form.Label>
            <Form.Control
              type="text"
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              data-testid="input-address-full-name"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Teléfono</Form.Label>
            <Form.Control
              type="text"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              data-testid="input-address-phone"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Línea 1 de la calle *</Form.Label>
            <Form.Control
              type="text"
              value={formData.streetLine1}
              onChange={(e) => handleChange('streetLine1', e.target.value)}
              data-testid="input-address-street-line-1"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Línea 2 de la calle</Form.Label>
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
                <Form.Label>Ciudad *</Form.Label>
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
                <Form.Label>Provincia *</Form.Label>
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
                <Form.Label>Código postal *</Form.Label>
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
                <Form.Label>País *</Form.Label>
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
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
            data-testid="btn-modal-save"
          >
            {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Añadir dirección'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default CustomerAddressFormModal;
