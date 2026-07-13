import React, { useEffect, useState } from 'react';
import { Modal, Form, Button, Alert, Table } from 'react-bootstrap';
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

const CjPromoteModal: React.FC<CjPromoteModalProps> = ({
  show,
  onHide,
  supplierId,
  items,
  categories,
  onSuccess,
}) => {
  const [categoryId, setCategoryId] = useState('');
  const [activateOnPromote, setActivateOnPromote] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, PriceOverride>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      setCategoryId('');
      setActivateOnPromote(false);
      setOverrides({});
      setError('');
    }
  }, [show]);

  const handlePriceChange = (id: number, field: keyof PriceOverride, value: string) => {
    setOverrides((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { publicPrice: '', compareAtPrice: '' }), [field]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
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
        categoryId: Number(categoryId),
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
            <Form.Label>Categoría *</Form.Label>
            <Form.Select
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
                  <th>Precio público</th>
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
