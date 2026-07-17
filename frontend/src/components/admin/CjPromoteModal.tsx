import React, { useEffect, useState } from 'react';
import { Modal, Form, Button, Alert, Table, Spinner } from 'react-bootstrap';
import { cjCatalogService, extractCjCatalogErrorMessage } from '../../services/cjCatalogService';
import { Category } from '../../types/category';
import { CjCatalogItem } from '../../types/cjCatalog';

type CjPromoteModalProps = {
  show: boolean;
  onHide: () => void;
  supplierId: number;
  items: CjCatalogItem[];
  categories: Category[];
  onSuccess: () => void;
};

type PriceOverride = { publicPrice: string; compareAtPrice: string };

type FreightEstimateState =
  | 'loading'
  | 'error'
  | { shippingCostEstimate: number; suggestedPublicPrice: number }
  | undefined;

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
  const [freightEstimates, setFreightEstimates] = useState<Record<number, FreightEstimateState>>({});

  useEffect(() => {
    if (show) {
      setCategoryId('');
      setOverrideCategory(false);
      setActivateOnPromote(false);
      setOverrides({});
      setFreightEstimates({});
      setError('');
    }
  }, [show]);

  // Fetches the real supplier shipping cost for every selected item as soon
  // as the modal opens — no manual "consultar envío" action: the public
  // price the admin sees must already include shipping + margin by default
  // (`items`/`supplierId` are intentionally left out of the dep array since
  // `items` is a fresh array reference on every parent render — this must
  // run once per open, mirroring the reset effect above, not on every
  // re-render while the modal stays open).
  useEffect(() => {
    if (!show || items.length === 0) return;
    let cancelled = false;
    setFreightEstimates(Object.fromEntries(items.map((item) => [item.id, 'loading' as const])));

    Promise.allSettled(items.map((item) => cjCatalogService.freightEstimate(supplierId, item.id))).then(
      (results) => {
        if (cancelled) return;
        setFreightEstimates((prev) => {
          const next = { ...prev };
          results.forEach((result, i) => {
            const itemId = items[i]!.id;
            next[itemId] = result.status === 'fulfilled' ? result.value.data : 'error';
          });
          return next;
        });
        setOverrides((prev) => {
          const next = { ...prev };
          results.forEach((result, i) => {
            if (result.status !== 'fulfilled') return;
            const itemId = items[i]!.id;
            const existing = next[itemId];
            if (existing?.publicPrice) return; // never clobber a price the admin already typed
            next[itemId] = {
              ...(existing ?? { publicPrice: '', compareAtPrice: '' }),
              publicPrice: String(result.value.data.suggestedPublicPrice),
            };
          });
          return next;
        });
      }
    );

    return () => {
      cancelled = true;
    };
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
    <Modal show={show} onHide={onHide} fullscreen="sm-down" data-testid="modal-promote-cj">
      <Modal.Header closeButton>
        <Modal.Title>Promocionar {items.length} artículo{items.length === 1 ? '' : 's'} del catálogo CJ</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              label="Elegir categoría manualmente (en vez de usar la categoría de CJ automáticamente)"
              checked={overrideCategory}
              onChange={(e) => {
                setOverrideCategory(e.target.checked);
                if (!e.target.checked) setCategoryId('');
              }}
              data-testid="checkbox-override-category"
            />
            {!overrideCategory && (
              <Form.Text className="text-muted d-block mt-1" data-testid="auto-category-hint">
                Se usará automáticamente la categoría de CJ Dropshipping. Si no se puede determinar, se usará la
                categoría predeterminada.
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
                  </option>
                ))}
              </Form.Select>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              label="Activar inmediatamente (visible en la tienda)"
              checked={activateOnPromote}
              onChange={(e) => setActivateOnPromote(e.target.checked)}
              data-testid="checkbox-activate-on-promote"
            />
          </Form.Group>

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
                {items.map((item) => {
                  const estimate = freightEstimates[item.id];
                  return (
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
                        {estimate === 'loading' && (
                          <Spinner animation="border" size="sm" role="status" aria-label="Consultando envío" />
                        )}
                        {estimate === 'error' && (
                          <span className="text-danger small">No se pudo consultar el envío.</span>
                        )}
                        {estimate && estimate !== 'loading' && estimate !== 'error' && (
                          <span>{estimate.shippingCostEstimate.toFixed(2)} €</span>
                        )}
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
                  );
                })}
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
