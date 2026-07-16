import React, { useEffect, useRef, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, Spinner } from 'react-bootstrap';
import { adminProductService, extractErrorMessage, extractErrorCode } from '../../services/adminProductService';
import {
  ProductVariant,
  ProductVariantStatus,
  StockPolicy,
  CreateVariantInput,
  UpdateVariantInput,
} from '../../types/product';
import StatusBadge from './StatusBadge';
import { adminStatusLabel } from '../../utils/adminStatusLabels';

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
  stockPolicy: 'SupplierManaged',
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
      setError('El SKU es obligatorio.');
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
          <Modal.Title>{mode === 'create' ? 'Añadir variante' : 'Editar variante'}</Modal.Title>
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
            <Form.Label>Talla</Form.Label>
            <Form.Control type="text" value={form.size} onChange={(e) => set('size', e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Color</Form.Label>
            <Form.Control type="text" value={form.color} onChange={(e) => set('color', e.target.value)} />
          </Form.Group>
          {mode === 'edit' && initial?.supplierCost != null && (
            <Form.Group className="mb-3">
              <Form.Label>Coste de proveedor (solo lectura)</Form.Label>
              <Form.Control
                type="text"
                value={new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(
                  initial.supplierCost
                )}
                readOnly
                disabled
                data-testid="input-variant-supplier-cost"
              />
              {initial.supplierName && (
                <Form.Text className="text-muted">Proveedor: {initial.supplierName}</Form.Text>
              )}
            </Form.Group>
          )}
          <Form.Group className="mb-3">
            <Form.Label>Precio público *</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              min="0"
              value={form.publicPrice}
              onChange={(e) => set('publicPrice', e.target.value)}
              required
              data-testid="input-variant-price"
            />
            {mode === 'edit' &&
              initial?.supplierCost != null &&
              Number(form.publicPrice) > 0 &&
              Number(form.publicPrice) <= initial.supplierCost && (
                <Form.Text className="text-danger">
                  Advertencia: el precio público es igual o inferior al coste del proveedor.
                </Form.Text>
              )}
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Precio de comparación</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              min="0"
              value={form.compareAtPrice}
              onChange={(e) => set('compareAtPrice', e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Política de stock</Form.Label>
            <Form.Select value={form.stockPolicy} onChange={(e) => set('stockPolicy', e.target.value)}>
              <option value="SupplierManaged">{adminStatusLabel('SupplierManaged')}</option>
              <option value="InternalStock">{adminStatusLabel('InternalStock')}</option>
              <option value="Hybrid">{adminStatusLabel('Hybrid')}</option>
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Estado</Form.Label>
            <Form.Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="Active">{adminStatusLabel('Active')}</option>
              <option value="Inactive">{adminStatusLabel('Inactive')}</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={saving} data-testid="btn-variant-save">
            {saving ? 'Guardando…' : 'Guardar'}
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

// Margin over the supplier cost: absolute € and % of the public price.
// Rendered red when selling below cost so pricing mistakes are obvious.
const Margin: React.FC<{ variant: ProductVariant }> = ({ variant }) => {
  const { publicPrice, supplierCost } = variant;
  if (supplierCost == null) return <>—</>;
  const margin = publicPrice - supplierCost;
  const pct = publicPrice > 0 ? (margin / publicPrice) * 100 : 0;
  return (
    <span className={margin < 0 ? 'text-danger fw-semibold' : undefined}>
      {formatPrice(margin)} ({pct.toFixed(0)}%)
    </span>
  );
};

// Net margin over supplier cost + shipping estimate. A missing shipping
// estimate is treated as 0 for the computation (per shipping-margin-guardrail
// spec) but flagged visually with an asterisk so admins know it's an
// approximation until they refresh the estimate.
const NetMargin: React.FC<{ variant: ProductVariant }> = ({ variant }) => {
  const { publicPrice, supplierCost, netMargin, shippingEstimateMissing, shippingCostEstimate } = variant;
  if (supplierCost == null) return <>—</>;
  const margin = netMargin ?? publicPrice - supplierCost - (shippingCostEstimate ?? 0);
  const pct = publicPrice > 0 ? (margin / publicPrice) * 100 : 0;
  return (
    <span className={margin < 0 ? 'text-danger fw-semibold' : undefined}>
      {formatPrice(margin)} ({pct.toFixed(0)}%)
      {shippingEstimateMissing && <span className="text-muted"> *</span>}
    </span>
  );
};

const MarginWarningBadge: React.FC<{ variant: ProductVariant }> = ({ variant }) => {
  if (!variant.marginWarning) return null;
  const isNegative = (variant.netMargin ?? 0) < 0;
  return (
    <Badge bg={isNegative ? 'danger' : 'warning'} data-testid={`variant-margin-warning-${variant.id}`}>
      {isNegative ? 'Vendiendo con pérdida' : 'Margen bajo'}
    </Badge>
  );
};

const VariantTable: React.FC<VariantTableProps> = ({ productId, variants, onVariantsChange }) => {
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<VariantFormMode>('create');
  const [editing, setEditing] = useState<ProductVariant | undefined>(undefined);
  const [deleting, setDeleting] = useState<ProductVariant | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [removing, setRemoving] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [fetchingShippingIds, setFetchingShippingIds] = useState<Set<number>>(new Set());
  // Tracks variant ids already attempted this page view so a variant with no
  // CJ mapping (CJ_ITEM_NOT_MAPPED — most manually-created variants) isn't
  // retried forever every time `variants` changes identity on refetch.
  const attemptedShippingIdsRef = useRef<Set<number>>(new Set());

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

  // Fetches and persists the CJ shipping estimate automatically for every
  // variant that's missing one — no manual action: the admin should already
  // see the shipping-informed net margin without doing anything. Variants
  // without a CJ mapping fail with CJ_ITEM_NOT_MAPPED, which is expected
  // (not every variant comes from CJ) and is suppressed rather than shown as
  // an error.
  useEffect(() => {
    const missing = variants.filter(
      (v) =>
        v.shippingEstimateMissing &&
        v.id != null &&
        !attemptedShippingIdsRef.current.has(v.id as number)
    );
    if (missing.length === 0) return;
    const ids = missing.map((v) => v.id as number);
    ids.forEach((id) => attemptedShippingIdsRef.current.add(id));
    setFetchingShippingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });

    let cancelled = false;
    Promise.allSettled(
      missing.map((v) => adminProductService.refreshFreightEstimate(productId, v.id as number))
    ).then((results) => {
      if (cancelled) return;
      setFetchingShippingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      const unexpected = results.find(
        (r): r is PromiseRejectedResult =>
          r.status === 'rejected' && extractErrorCode(r.reason) !== 'CJ_ITEM_NOT_MAPPED'
      );
      if (unexpected) setRefreshError(extractErrorMessage(unexpected.reason));
      if (results.some((r) => r.status === 'fulfilled')) onVariantsChange();
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants]);

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
          Añadir variante
        </Button>
      </div>

      {refreshError && <Alert variant="danger">{refreshError}</Alert>}

      {variants.length === 0 ? (
        <Alert variant="info" className="mb-0">
          Aún no hay variantes. Añada al menos una variante activa para activar el producto.
        </Alert>
      ) : (
        <>
          <div className="d-lg-none admin-card-list" data-testid="variants-card-list">
            {variants.map((v) => (
              <div key={v.id} className="admin-card-row" data-testid={`variant-card-${v.id}`}>
                <div className="fw-semibold mb-2">
                  <code>{v.sku}</code>
                </div>
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Talla</span>
                  <span>{v.size ?? '—'}</span>
                </div>
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Color</span>
                  <span>{v.color ?? '—'}</span>
                </div>
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Coste de proveedor</span>
                  <span>{formatPrice(v.supplierCost)}</span>
                </div>
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Precio público</span>
                  <span>{formatPrice(v.publicPrice)}</span>
                </div>
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Margen</span>
                  <span>
                    <Margin variant={v} />
                  </span>
                </div>
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Envío estimado</span>
                  <span>
                    {fetchingShippingIds.has(v.id as number) ? (
                      <Spinner animation="border" size="sm" role="status" aria-label="Consultando envío" />
                    ) : (
                      formatPrice(v.shippingCostEstimate)
                    )}
                  </span>
                </div>
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Margen neto</span>
                  <span>
                    <NetMargin variant={v} />
                  </span>
                </div>
                <MarginWarningBadge variant={v} />
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Precio de comparación</span>
                  <span>{formatPrice(v.compareAtPrice)}</span>
                </div>
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Política de stock</span>
                  <span>{adminStatusLabel(v.stockPolicy)}</span>
                </div>
                <div className="admin-card-row__field">
                  <span className="admin-card-row__label">Estado</span>
                  <StatusBadge status={v.status === 'Active' ? 'Active' : 'Inactive'} />
                </div>
                <div className="admin-card-row__actions">
                  <Button
                    variant="outline-primary"
                    className="admin-touch-btn"
                    onClick={() => openEdit(v)}
                    data-testid={`btn-edit-variant-${v.id}`}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="outline-danger"
                    className="admin-touch-btn"
                    onClick={() => setDeleting(v)}
                    data-testid={`btn-delete-variant-${v.id}`}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="d-none d-lg-block admin-table-wrap">
            <Table size="sm" hover data-testid="variants-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Talla</th>
                <th>Color</th>
                <th>Coste de proveedor</th>
                <th>Precio público</th>
                <th>Margen</th>
                <th>Envío estimado</th>
                <th>Margen neto</th>
                <th>Alerta</th>
                <th>Precio de comparación</th>
                <th>Política de stock</th>
                <th>Estado</th>
                <th>Acciones</th>
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
                  <td data-testid={`variant-supplier-cost-${v.id}`}>{formatPrice(v.supplierCost)}</td>
                  <td>{formatPrice(v.publicPrice)}</td>
                  <td data-testid={`variant-margin-${v.id}`}>
                    <Margin variant={v} />
                  </td>
                  <td data-testid={`variant-shipping-estimate-${v.id}`}>
                    {fetchingShippingIds.has(v.id as number) ? (
                      <Spinner animation="border" size="sm" role="status" aria-label="Consultando envío" />
                    ) : (
                      formatPrice(v.shippingCostEstimate)
                    )}
                  </td>
                  <td data-testid={`variant-net-margin-${v.id}`}>
                    <NetMargin variant={v} />
                  </td>
                  <td>
                    <MarginWarningBadge variant={v} />
                  </td>
                  <td>{formatPrice(v.compareAtPrice)}</td>
                  <td>{adminStatusLabel(v.stockPolicy)}</td>
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
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => setDeleting(v)}
                      data-testid={`btn-delete-variant-${v.id}`}
                    >
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            </Table>
          </div>
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
          <Modal.Title>Eliminar variante</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteError && <Alert variant="danger">{deleteError}</Alert>}
          ¿Está seguro de que desea eliminar la variante <code>{deleting?.sku}</code>?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={removing}
            onClick={confirmDelete}
            data-testid="btn-confirm-delete-variant"
          >
            {removing ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default VariantTable;
