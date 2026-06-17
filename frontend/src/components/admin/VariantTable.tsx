import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Alert } from 'react-bootstrap';
import { adminProductService, extractErrorMessage } from '../../services/adminProductService';
import {
  ProductVariant,
  ProductVariantStatus,
  StockPolicy,
  CreateVariantInput,
  UpdateVariantInput,
} from '../../types/product';
import StatusBadge from './StatusBadge';

type VariantFormMode = 'create' | 'edit';

type VariantFormData = {
  sku: string;
  size: string;
  color: string;
  publicPrice: string;
  compareAtPrice: string;
  stockPolicy: StockPolicy;
  status: ProductVariantStatus;
};

const EMPTY_FORM: VariantFormData = {
  sku: '',
  size: '',
  color: '',
  publicPrice: '',
  compareAtPrice: '',
  stockPolicy: 'TRACK',
  status: 'Active',
};

type VariantFormModalProps = {
  show: boolean;
  mode: VariantFormMode;
  productId: number;
  initial?: ProductVariant;
  onHide: () => void;
  onSuccess: () => void;
};

export const VariantFormModal: React.FC<VariantFormModalProps> = ({
  show,
  mode,
  productId,
  initial,
  onHide,
  onSuccess,
}) => {
  const [form, setForm] = useState<VariantFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!show) return;
    setError('');
    if (mode === 'edit' && initial) {
      setForm({
        sku: initial.sku,
        size: initial.size ?? '',
        color: initial.color ?? '',
        publicPrice: String(initial.publicPrice),
        compareAtPrice: initial.compareAtPrice != null ? String(initial.compareAtPrice) : '',
        stockPolicy: initial.stockPolicy,
        status: initial.status === 'Active' ? 'Active' : 'Inactive',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [show, mode, initial]);

  const set = (key: keyof VariantFormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku.trim()) {
      setError('SKU is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Build the payload from known fields only — never spread supplier data.
      if (mode === 'create') {
        const payload: CreateVariantInput = {
          sku: form.sku.trim(),
          size: form.size || null,
          color: form.color || null,
          publicPrice: Number(form.publicPrice),
          compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null,
          stockPolicy: form.stockPolicy,
          status: form.status,
        };
        await adminProductService.createVariant(productId, payload);
      } else if (initial) {
        const payload: UpdateVariantInput = {
          sku: form.sku.trim(),
          size: form.size || null,
          color: form.color || null,
          publicPrice: Number(form.publicPrice),
          compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null,
          stockPolicy: form.stockPolicy,
          status: form.status,
        };
        await adminProductService.updateVariant(productId, initial.id as number, payload);
      }
      onSuccess();
      onHide();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} fullscreen="sm-down" data-testid="modal-variant">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>{mode === 'create' ? 'Add variant' : 'Edit variant'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>SKU *</Form.Label>
            <Form.Control
              type="text"
              value={form.sku}
              onChange={(e) => set('sku', e.target.value)}
              required
              data-testid="input-variant-sku"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Size</Form.Label>
            <Form.Control type="text" value={form.size} onChange={(e) => set('size', e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Color</Form.Label>
            <Form.Control type="text" value={form.color} onChange={(e) => set('color', e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Public price *</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              min="0"
              value={form.publicPrice}
              onChange={(e) => set('publicPrice', e.target.value)}
              required
              data-testid="input-variant-price"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Compare-at price</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              min="0"
              value={form.compareAtPrice}
              onChange={(e) => set('compareAtPrice', e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Stock policy</Form.Label>
            <Form.Select value={form.stockPolicy} onChange={(e) => set('stockPolicy', e.target.value)}>
              <option value="TRACK">TRACK</option>
              <option value="DONT_TRACK">DONT_TRACK</option>
              <option value="DENY">DENY</option>
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Status</Form.Label>
            <Form.Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving} data-testid="btn-variant-save">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

type VariantTableProps = {
  productId: number;
  variants: ProductVariant[];
  onVariantsChange: () => void;
};

const formatPrice = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(n);

const VariantTable: React.FC<VariantTableProps> = ({ productId, variants, onVariantsChange }) => {
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<VariantFormMode>('create');
  const [editing, setEditing] = useState<ProductVariant | undefined>(undefined);
  const [deleting, setDeleting] = useState<ProductVariant | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [removing, setRemoving] = useState(false);

  const openCreate = () => {
    setModalMode('create');
    setEditing(undefined);
    setShowModal(true);
  };

  const openEdit = (variant: ProductVariant) => {
    setModalMode('edit');
    setEditing(variant);
    setShowModal(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setRemoving(true);
    setDeleteError('');
    try {
      await adminProductService.deleteVariant(productId, deleting.id as number);
      setDeleting(null);
      onVariantsChange();
    } catch (err) {
      setDeleteError(extractErrorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <div className="d-flex justify-content-end mb-2">
        <Button size="sm" variant="primary" onClick={openCreate} data-testid="btn-add-variant">
          Add variant
        </Button>
      </div>

      {variants.length === 0 ? (
        <Alert variant="info" className="mb-0">
          No variants yet. Add at least one active variant to activate the product.
        </Alert>
      ) : (
        <>
          <div className="d-md-none admin-card-list" data-testid="variants-card-list">
            {variants.map((v) => (
              <div key={v.id} className="admin-card-row" data-testid={`variant-card-${v.id}`}>
                <div className="fw-semibold mb-2">
                  <code>{v.sku}</code>
                </div>
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Size</span>
                  <span>{v.size ?? '—'}</span>
                </div>
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Color</span>
                  <span>{v.color ?? '—'}</span>
                </div>
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Public price</span>
                  <span>{formatPrice(v.publicPrice)}</span>
                </div>
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Compare-at</span>
                  <span>{formatPrice(v.compareAtPrice)}</span>
                </div>
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Stock policy</span>
                  <span>{v.stockPolicy}</span>
                </div>
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Status</span>
                  <StatusBadge status={v.status === 'Active' ? 'Active' : 'Inactive'} />
                </div>
                <div className="admin-card-row__actions">
                  <Button
                    variant="outline-primary"
                    className="admin-touch-btn"
                    onClick={() => openEdit(v)}
                    data-testid={`btn-edit-variant-${v.id}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline-danger"
                    className="admin-touch-btn"
                    onClick={() => setDeleting(v)}
                    data-testid={`btn-delete-variant-${v.id}`}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Table size="sm" hover responsive className="d-none d-md-table" data-testid="variants-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Size</th>
                <th>Color</th>
                <th>Public price</th>
                <th>Compare-at</th>
                <th>Stock policy</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} data-testid={`variant-row-${v.id}`}>
                  <td>
                    <code>{v.sku}</code>
                  </td>
                  <td>{v.size ?? '—'}</td>
                  <td>{v.color ?? '—'}</td>
                  <td>{formatPrice(v.publicPrice)}</td>
                  <td>{formatPrice(v.compareAtPrice)}</td>
                  <td>{v.stockPolicy}</td>
                  <td>
                    <StatusBadge status={v.status === 'Active' ? 'Active' : 'Inactive'} />
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      className="me-2"
                      onClick={() => openEdit(v)}
                      data-testid={`btn-edit-variant-${v.id}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => setDeleting(v)}
                      data-testid={`btn-delete-variant-${v.id}`}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}

      <VariantFormModal
        show={showModal}
        mode={modalMode}
        productId={productId}
        initial={editing}
        onHide={() => setShowModal(false)}
        onSuccess={onVariantsChange}
      />

      <Modal show={deleting !== null} onHide={() => setDeleting(null)} fullscreen="sm-down">
        <Modal.Header closeButton>
          <Modal.Title>Delete variant</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteError && <Alert variant="danger">{deleteError}</Alert>}
          Are you sure you want to delete variant <code>{deleting?.sku}</code>?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={removing}
            onClick={confirmDelete}
            data-testid="btn-confirm-delete-variant"
          >
            {removing ? 'Deleting…' : 'Delete'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default VariantTable;
