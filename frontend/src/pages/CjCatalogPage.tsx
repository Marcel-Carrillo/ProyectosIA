import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Table, Button, Alert, Row, Col, Form } from 'react-bootstrap';
import { cjCatalogService, extractCjCatalogErrorMessage } from '../services/cjCatalogService';
import {
  cjConnectionService,
  extractCjConnectionErrorCode,
  extractCjConnectionErrorMessage,
} from '../services/cjConnectionService';
import { categoryService } from '../services/categoryService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/admin/StatusBadge';
import CjPromoteModal from '../components/admin/CjPromoteModal';
import CjConnectionPanel from '../components/admin/CjConnectionPanel';
import CjConnectionModal from '../components/admin/CjConnectionModal';
import { CjCatalogItem, CjPromotionState, CjSyncStatus } from '../types/cjCatalog';
import { CjConnection } from '../types/cjConnection';
import { Category } from '../types/category';
import { adminStatusLabel } from '../utils/adminStatusLabels';

const PAGE_SIZE = 20;

const CjCatalogPage: React.FC = () => {
  const { supplierId: supplierIdParam } = useParams<{ supplierId: string }>();
  const supplierId = Number(supplierIdParam);

  const [searchParams, setSearchParams] = useSearchParams();
  const [syncStatusFilter, setSyncStatusFilter] = useState(searchParams.get('syncStatus') ?? '');
  const [promotionStateFilter, setPromotionStateFilter] = useState(searchParams.get('promotionState') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1') || 1);

  const [items, setItems] = useState<CjCatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showPromoteModal, setShowPromoteModal] = useState(false);

  const [actioningId, setActioningId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');

  const [connection, setConnection] = useState<CjConnection | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [connectionNotFound, setConnectionNotFound] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [showConnectionModal, setShowConnectionModal] = useState(false);

  // Only the very first connection fetch should toggle connectionLoading.
  // Verify/Sync trigger later refreshes via the same fetchConnection (as
  // onRefreshConnection); if those also toggled connectionLoading, every
  // element gated on it (the panel itself, the catalog-fetch effect, a
  // possibly-open CjPromoteModal) would unmount/remount mid-action under
  // real network latency, discarding their local state.
  const hasLoadedConnectionOnce = useRef(false);

  useEffect(() => {
    categoryService.getAll().then(setCategories).catch(() => setCategories([]));
  }, []);

  const fetchConnection = useCallback(async () => {
    if (!hasLoadedConnectionOnce.current) setConnectionLoading(true);
    try {
      const res = await cjConnectionService.getConnection(supplierId);
      setConnection(res.data);
      setConnectionNotFound(false);
      setConnectionError('');
    } catch (err) {
      if (extractCjConnectionErrorCode(err) === 'CJ_CONNECTION_NOT_FOUND') {
        setConnection(null);
        setConnectionNotFound(true);
        setConnectionError('');
      } else {
        // A non-404 failure (e.g. a 500) is not the same as "no connection
        // exists" — never null out a previously-loaded `connection` here, or
        // a transient failure would be misrepresented as "not configured".
        setConnectionNotFound(false);
        setConnectionError(extractCjConnectionErrorMessage(err));
      }
    } finally {
      setConnectionLoading(false);
      hasLoadedConnectionOnce.current = true;
    }
  }, [supplierId]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (syncStatusFilter) params.set('syncStatus', syncStatusFilter);
    if (promotionStateFilter) params.set('promotionState', promotionStateFilter);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [syncStatusFilter, promotionStateFilter, page, setSearchParams]);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await cjCatalogService.listCatalog(supplierId, {
        syncStatus: (syncStatusFilter as CjSyncStatus) || undefined,
        promotionState: (promotionStateFilter as CjPromotionState) || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(res.data.items);
      setTotal(res.data.total);
      setSelectedIds(new Set());
    } catch (err) {
      setError(extractCjCatalogErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [supplierId, syncStatusFilter, promotionStateFilter, page]);

  useEffect(() => {
    if (connectionLoading || connectionNotFound) return;
    fetchCatalog();
  }, [fetchCatalog, connectionLoading, connectionNotFound]);

  const handleFilterChange = (key: 'syncStatus' | 'promotionState', value: string) => {
    if (key === 'syncStatus') setSyncStatusFilter(value);
    else setPromotionStateFilter(value);
    setPage(1);
  };
  const handleReset = () => {
    setSyncStatusFilter('');
    setPromotionStateFilter('');
    setPage(1);
  };

  const selectableItems = items.filter((i) => i.syncStatus === 'Synced');
  const selectedItems = items.filter((i) => selectedIds.has(i.id));
  const allSelectableSelected = selectableItems.length > 0 && selectableItems.every((i) => selectedIds.has(i.id));

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      if (allSelectableSelected) return new Set();
      const next = new Set(prev);
      selectableItems.forEach((i) => next.add(i.id));
      return next;
    });
  };

  const handlePromoteSuccess = () => {
    setShowPromoteModal(false);
    setSelectedIds(new Set());
    fetchCatalog();
  };

  const handleActivate = async (id: number) => {
    setActioningId(id);
    setActionError('');
    try {
      await cjCatalogService.activate(supplierId, id);
      fetchCatalog();
    } catch (err) {
      setActionError(extractCjCatalogErrorMessage(err));
    } finally {
      setActioningId(null);
    }
  };

  const handleDeactivate = async (id: number) => {
    setActioningId(id);
    setActionError('');
    try {
      await cjCatalogService.deactivate(supplierId, id);
      fetchCatalog();
    } catch (err) {
      setActionError(extractCjCatalogErrorMessage(err));
    } finally {
      setActioningId(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="h3 mb-0">Catálogo CJ</h1>
      </div>

      {connectionLoading && (
        <div data-testid="connection-loading-state">
          <LoadingSpinner />
        </div>
      )}

      {!connectionLoading && connectionError && !connection && !connectionNotFound && (
        <ErrorAlert message={connectionError} />
      )}

      {!connectionLoading && (connection || connectionNotFound) && (
        <CjConnectionPanel
          supplierId={supplierId}
          connection={connection}
          onConfigureClick={() => setShowConnectionModal(true)}
          onRefreshConnection={fetchConnection}
          onCatalogRefreshNeeded={fetchCatalog}
        />
      )}

      <CjConnectionModal
        show={showConnectionModal}
        onHide={() => setShowConnectionModal(false)}
        supplierId={supplierId}
        connection={connection}
        onSuccess={(updated) => {
          setConnection(updated);
          setConnectionNotFound(false);
        }}
      />

      {!connectionLoading && !connectionNotFound && (
        <>
          <Row className="g-2 mb-3 align-items-end">
            <Col xs={12} md={4}>
              <Form.Label className="small mb-1">Estado de sincronización</Form.Label>
              <Form.Select
                value={syncStatusFilter}
                onChange={(e) => handleFilterChange('syncStatus', e.target.value)}
                data-testid="filter-sync-status"
              >
                <option value="">Todos</option>
                <option value="Synced">{adminStatusLabel('Synced')}</option>
                <option value="Failed">{adminStatusLabel('Failed')}</option>
              </Form.Select>
            </Col>
            <Col xs={12} md={4}>
              <Form.Label className="small mb-1">Estado de promoción</Form.Label>
              <Form.Select
                value={promotionStateFilter}
                onChange={(e) => handleFilterChange('promotionState', e.target.value)}
                data-testid="filter-promotion-state"
              >
                <option value="">Todos</option>
                <option value="NotPromoted">{adminStatusLabel('NotPromoted')}</option>
                <option value="Active">{adminStatusLabel('Active')}</option>
                <option value="Inactive">{adminStatusLabel('Inactive')}</option>
              </Form.Select>
            </Col>
            <Col xs={12} md={4}>
              <Button
                variant="outline-secondary"
                className="w-100 admin-touch-btn"
                onClick={handleReset}
                data-testid="btn-filter-reset"
              >
                Restablecer
              </Button>
            </Col>
          </Row>

          {selectedIds.size > 0 && (
            <Alert variant="light" className="d-flex align-items-center gap-2" data-testid="bulk-action-bar">
              <span>{selectedIds.size} seleccionados</span>
              <Button size="sm" onClick={() => setShowPromoteModal(true)} data-testid="btn-promote-selected">
                Promocionar seleccionados
              </Button>
              <Button
                size="sm"
                variant="link"
                onClick={() => setSelectedIds(new Set())}
                data-testid="btn-clear-selection"
              >
                Limpiar
              </Button>
            </Alert>
          )}

          {actionError && (
            <Alert variant="danger" data-testid="action-error">
              {actionError}
            </Alert>
          )}

          {loading && (
            <div data-testid="loading-state">
              <LoadingSpinner />
            </div>
          )}
          {!loading && error && <ErrorAlert message={error} />}
          {!loading && !error && items.length === 0 && (
            <Alert variant="info" data-testid="empty-state">
              No se encontraron artículos en el catálogo CJ.
            </Alert>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="d-lg-none admin-card-list" data-testid="cj-catalog-card-list">
                {items.map((item) => (
                  <div key={item.id} className="admin-card-row" data-testid={`cj-catalog-card-row-${item.id}`}>
                    <div className="admin-card-row__header">
                      <Form.Check
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        disabled={item.syncStatus === 'Failed'}
                        onChange={() => toggleSelect(item.id)}
                        data-testid={`checkbox-select-${item.id}`}
                      />
                      <div className="flex-grow-1">
                        <div className="fw-semibold">{item.title}</div>
                        <div className="admin-card-row__meta">
                          {[item.size, item.color].filter(Boolean).join(' / ') || '—'} · {item.supplierCost}
                        </div>
                        <StatusBadge status={item.syncStatus} data-testid={`sync-badge-${item.id}`} />{' '}
                        <StatusBadge status={item.promotionState} data-testid={`promotion-badge-${item.id}`} />
                      </div>
                    </div>
                    <div className="admin-card-row__actions">
                      {item.promotionState === 'Active' && (
                        <Button
                          variant="outline-warning"
                          className="admin-touch-btn"
                          disabled={actioningId === item.id}
                          onClick={() => handleDeactivate(item.id)}
                          data-testid={`btn-deactivate-${item.id}`}
                        >
                          Desactivar
                        </Button>
                      )}
                      {item.promotionState === 'Inactive' && (
                        <Button
                          variant="outline-success"
                          className="admin-touch-btn"
                          disabled={actioningId === item.id}
                          onClick={() => handleActivate(item.id)}
                          data-testid={`btn-activate-${item.id}`}
                        >
                          Activar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="d-none d-lg-block admin-table-wrap">
                <Table hover data-testid="cj-catalog-table">
                  <thead>
                    <tr>
                      <th>
                        <Form.Check
                          type="checkbox"
                          checked={allSelectableSelected}
                          onChange={toggleSelectAllOnPage}
                          data-testid="checkbox-select-all"
                        />
                      </th>
                      <th>Título</th>
                      <th>SKU</th>
                      <th>Coste</th>
                      <th>Existencias</th>
                      <th>Sincronización</th>
                      <th>Promoción</th>
                      <th>Producto</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} data-testid={`cj-catalog-row-${item.id}`}>
                        <td>
                          <Form.Check
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            disabled={item.syncStatus === 'Failed'}
                            onChange={() => toggleSelect(item.id)}
                            data-testid={`checkbox-select-${item.id}`}
                          />
                        </td>
                        <td>
                          {item.title}
                          <div className="admin-card-row__meta">
                            {[item.size, item.color].filter(Boolean).join(' / ')}
                          </div>
                        </td>
                        <td>{item.sku ?? '—'}</td>
                        <td>{item.supplierCost}</td>
                        <td>{item.stockQuantity}</td>
                        <td>
                          <StatusBadge status={item.syncStatus} data-testid={`sync-badge-${item.id}`} />
                        </td>
                        <td>
                          <StatusBadge status={item.promotionState} data-testid={`promotion-badge-${item.id}`} />
                        </td>
                        <td>
                          {item.promotionState !== 'NotPromoted' && item.productId ? (
                            <Link to={`/products/${item.productId}`}>{item.productId}</Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {item.promotionState === 'Active' && (
                            <Button
                              size="sm"
                              variant="outline-warning"
                              disabled={actioningId === item.id}
                              onClick={() => handleDeactivate(item.id)}
                              data-testid={`btn-deactivate-${item.id}`}
                            >
                              Desactivar
                            </Button>
                          )}
                          {item.promotionState === 'Inactive' && (
                            <Button
                              size="sm"
                              variant="outline-success"
                              disabled={actioningId === item.id}
                              onClick={() => handleActivate(item.id)}
                              data-testid={`btn-activate-${item.id}`}
                            >
                              Activar
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}

          {!loading && !error && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}

          <CjPromoteModal
            show={showPromoteModal}
            onHide={() => setShowPromoteModal(false)}
            supplierId={supplierId}
            items={selectedItems}
            categories={categories}
            onSuccess={handlePromoteSuccess}
          />
        </>
      )}
    </div>
  );
};

export default CjCatalogPage;
