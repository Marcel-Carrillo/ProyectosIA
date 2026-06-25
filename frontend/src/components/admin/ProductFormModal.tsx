import React, { useEffect, useState } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { adminProductService, extractErrorMessage } from '../../services/adminProductService';
import { Category } from '../../types/category';
import { CreateProductInput, Product } from '../../types/product';
import { buildTranslationsPayload } from '../../utils/translationFormHelpers';

type ProductFormModalProps = {
  show: boolean;
  onHide: () => void;
  onSuccess: (product: Product) => void;
  categories: Category[];
};

type FormData = {
  name: string;
  description: string;
  brand: string;
  categoryId: string;
  mainImageUrl: string;
  nameEs: string;
  descriptionEs: string;
};

const EMPTY: FormData = { name: '', description: '', brand: '', categoryId: '', mainImageUrl: '', nameEs: '', descriptionEs: '' };

const ProductFormModal: React.FC<ProductFormModalProps> = ({ show, onHide, onSuccess, categories }) => {
  const { t } = useTranslation('admin');
  const [formData, setFormData] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      setFormData(EMPTY);
      setError('');
    }
  }, [show]);

  const handleChange = (key: keyof FormData, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const translations = buildTranslationsPayload({
        name: formData.name,
        description: formData.description,
        nameEn: formData.name,
        descriptionEn: formData.description,
        nameEs: formData.nameEs,
        descriptionEs: formData.descriptionEs,
      });
      const payload: CreateProductInput = {
        name: formData.name.trim(),
        description: formData.description || null,
        brand: formData.brand || null,
        categoryId: formData.categoryId ? Number(formData.categoryId) : null,
        mainImageUrl: formData.mainImageUrl || null,
        translations: translations.length > 0 ? translations : undefined,
      };
      const res = await adminProductService.create(payload);
      onSuccess(res.data);
      onHide();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} fullscreen="sm-down" data-testid="modal-create-product">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>New product</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Name *</Form.Label>
            <Form.Control
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              data-testid="input-product-name"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              data-testid="input-product-description"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Brand</Form.Label>
            <Form.Control
              type="text"
              value={formData.brand}
              onChange={(e) => handleChange('brand', e.target.value)}
              data-testid="input-product-brand"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Category</Form.Label>
            <Form.Select
              value={formData.categoryId}
              onChange={(e) => handleChange('categoryId', e.target.value)}
              data-testid="select-product-category"
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Main image URL</Form.Label>
            <Form.Control
              type="text"
              value={formData.mainImageUrl}
              onChange={(e) => handleChange('mainImageUrl', e.target.value)}
              data-testid="input-product-image-url"
            />
          </Form.Group>
          <hr />
          <p className="text-muted small mb-2">{t('product.form.spanishSection')}</p>
          <Form.Group className="mb-3">
            <Form.Label>{t('product.form.nameEs')}</Form.Label>
            <Form.Control
              type="text"
              value={formData.nameEs}
              onChange={(e) => handleChange('nameEs', e.target.value)}
              data-testid="input-product-name-es"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>{t('product.form.descriptionEs')}</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={formData.descriptionEs}
              onChange={(e) => handleChange('descriptionEs', e.target.value)}
              data-testid="input-product-description-es"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} data-testid="btn-modal-cancel">
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving} data-testid="btn-modal-save">
            {saving ? 'Saving…' : 'Create'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default ProductFormModal;
