import React, { useEffect, useState } from 'react';
import { Modal, Form, Button, Alert, Table } from 'react-bootstrap';
import { cjCatalogService, extractCjCatalogErrorMessage } from '../../services/cjCatalogService';
import { Category } from '../../types/category';
import { CjCatalogItem } from '../../types/cjCatalog';
import {
  CJ_DEFAULT_SHIPPING_ESTIMATE,
  computeCjPublicPrice,
} from '../../utils/cjPricing';

type CjPromoteModalProps = {
  show: boolean;
  onHide: () => void;
  supplierId: number;
  items: CjCatalogItem[];
  categories: Category[];
  onSuccess: () => void;
};

type PriceOverride = { publicPrice: string; compareAtPrice: string };

const buildDefaultOverrides = (items: CjCatalogItem[]): Record<number, PriceOverride> =>
  Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        publicPrice: String(computeCjPublicPrice(Number(item.supplierCost))),
        compareAtPrice: '',
      },
    ])
  );

const CjPromoteModal: React.FC<CjPromoteModalProps> = ({
  show,
  onHide,
  supplierId,
  items,
  categories,
  onSuccess,
}) => {
  const [categoryId, setCategoryId] = useState('');
  const [overrideCategory, setOverrideCategory] = useState(false);
  const [activateOnPromote, setActivateOnPromote] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, PriceOverride>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      setCategoryId('');
      setOverrideCategory(false);
      setActivateOnPromote(false);
      setOverrides(buildDefaultOverrides(items));
      setError('');
    }
    // `items` intentionally omitted: reset once per open, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const handlePriceChange = (id: number, field: keyof PriceOverride, value: string) => {
    setOverrides((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { publicPrice: '', compareAtPrice: '' }), [field]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (overrideCategory && !categoryId) {
      setError('Seleccione una categoría antes de promocionar.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await cjCatalogService.promote(supplierId, {
        items: items.map((item) => {
          const override = overrides[item.id];
          const publicPrice = override?.publicPrice ? Number(override.publicPrice) : undefined;
          const compareAtPrice = override?.compareAtPrice ? Number(override.compareAtPrice) : undefined;
          return { cjCatalogItemId: item.id, publicPrice, compareAtPrice };
        }),
        ...(overrideCategory && categoryId ? { categoryId: Number(categoryId) } : {}),
        activate: activateOnPromote,
      });
      onSuccess();
      onHide();
    } catch (err) {
      setError(extractCjCatalogErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered data-testid="modal-promote-cj">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Promocionar al catálogo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert variant="danger" data-testid="promote-error">
              {error}
            </Alert>
          )}

          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              id="override-category"
              label="Elegir una categoría fija (en lugar de la de CJ)"
              checked={overrideCategory}
              onChange={(e) => setOverrideCategory(e.target.checked)}
              data-testid="checkbox-override-category"
            />
            {!overrideCategory && (
              <Form.Text className="text-muted d-block" data-testid="auto-category-hint">
                Se usará automáticamente la categoría de CJ Dropshipping. Si no se puede determinar, se usará la
                categoría por defecto configurada.
              </Form.Text>
            )}
            {overrideCategory && (
              <Form.Select
                className="mt-2"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                data-testid="select-promote-category"
              >
                <option value="">Seleccione una categoría…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.status === 'Inactive' ? ' (inactiva)' : ''}
                  </option>
                ))}
              </Form.Select>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              id="activate-on-promote"
              label="Activar productos al promocionar"
              checked={activateOnPromote}
              onChange={(e) => setActivateOnPromote(e.target.checked)}
              data-testid="checkbox-activate-on-promote"
            />
          </Form.Group>

          <p className="small text-muted mb-2" data-testid="pricing-formula-hint">
            Precio público = coste × 1,6 (margen 60 %) + {CJ_DEFAULT_SHIPPING_ESTIMATE.toFixed(0)} € de envío
            estimado.
          </p>

          <div className="admin-table-wrap">
            <Table size="sm" data-testid="promote-items-table">
              <thead>
                <tr>
                  <th>Artículo</th>
                  <th>Coste</th>
                  <th>Envío estimado</th>
                  <th>Precio público (coste + envío + margen)</th>
                  <th>Precio de comparación</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.title}
                      {(item.size || item.color) && (
                        <div className="admin-card-row__meta">
                          {[item.size, item.color].filter(Boolean).join(' / ')}
                        </div>
                      )}
                    </td>
                    <td>{item.supplierCost}</td>
                    <td data-testid={`variant-shipping-estimate-${item.id}`}>
                      {CJ_DEFAULT_SHIPPING_ESTIMATE.toFixed(2)} €
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Margen predeterminado"
                        value={overrides[item.id]?.publicPrice ?? ''}
                        onChange={(e) => handlePriceChange(item.id, 'publicPrice', e.target.value)}
                        data-testid={`input-price-${item.id}`}
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="0"
                        value={overrides[item.id]?.compareAtPrice ?? ''}
                        onChange={(e) => handlePriceChange(item.id, 'compareAtPrice', e.target.value)}
                        data-testid={`input-compare-price-${item.id}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={submitting} data-testid="btn-modal-cancel">
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={submitting} data-testid="btn-modal-promote">
            {submitting ? 'Promocionando…' : 'Promocionar'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default CjPromoteModal;
