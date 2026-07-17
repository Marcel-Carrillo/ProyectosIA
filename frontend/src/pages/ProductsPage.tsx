import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Alert, Modal } from 'react-bootstrap';
import { adminProductService, extractErrorMessage } from '../services/adminProductService';
import { categoryService } from '../services/categoryService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/admin/StatusBadge';
import ProductFilters, { FiltersState } from '../components/admin/ProductFilters';
import ProductFormModal from '../components/admin/ProductFormModal';
import { Product, ProductStatus, ProductQueryParams } from '../types/product';
import { Category } from '../types/category';

const PAGE_SIZE = 20;

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

function getMinSupplierCost(product: Product): number | null {
  const costs = (product.variants ?? [])
    .map((v) => v.supplierCost)
    .filter((c): c is number => c != null && Number.isFinite(c));
  if (costs.length === 0) return null;
  return Math.min(...costs);
}

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<FiltersState>({
    status: searchParams.get('status') ?? '',
    categoryId: searchParams.get('categoryId') ?? '',
    search: searchParams.get('search') ?? '',
    sort: (searchParams.get('sort') as 'name' | 'createdAt') || 'createdAt',
    order: (searchParams.get('order') as 'asc' | 'desc') || 'desc',
  });
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1') || 1);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Load categories once for the filter dropdown.
  useEffect(() => {
    categoryService
      .getAllAdmin()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Debounce the search field (400ms); other filters are immediate.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 400);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Keep the URL query string in sync.
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.search) params.set('search', filters.search);
    params.set('sort', filters.sort);
    params.set('order', filters.order);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [filters, page, setSearchParams]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: ProductQueryParams = {
        status: (filters.status as ProductStatus) || undefined,
        categoryId: filters.categoryId ? Number(filters.categoryId) : undefined,
        search: debouncedSearch || undefined,
        sort: filters.sort,
        order: filters.order,
        page,
        pageSize: PAGE_SIZE,
      };
      const res = await adminProductService.list(params);
      setProducts(res.data.items);
      setTotal(res.data.total);
    } catch {
      setError('No se pudieron cargar los productos. Intente de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.categoryId, filters.sort, filters.order, debouncedSearch, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleFilterChange = (key: keyof FiltersState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleReset = () => {
    setFilters({ status: '', categoryId: '', search: '', sort: 'createdAt', order: 'desc' });
    setPage(1);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await adminProductService.remove(toDelete.id as number);
      setToDelete(null);
      fetchProducts();
    } catch (err) {
      setDeleteError(extractErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="h3 mb-0">Productos</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)} data-testid="btn-new-product">
          Nuevo producto
        </Button>
      </div>

      <ProductFilters
        filters={filters}
        categories={categories}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />

      {loading && (
        <div data-testid="loading-state">
          <LoadingSpinner />
        </div>
      )}
      {!loading && error && <ErrorAlert message={error} />}
      {!loading && !error && products.length === 0 && (
        <Alert variant="info" data-testid="empty-state">
          No se encontraron productos.
        </Alert>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="admin-product-card-grid" data-testid="products-card-list">
          {products.map((product) => {
            const supplierCost = getMinSupplierCost(product);
            return (
              <article
                key={product.id}
                className="admin-product-card"
                data-testid={`product-card-row-${product.id}`}
              >
                <Link
                  to={`/products/${product.id}`}
                  className="admin-product-card__media"
                  data-testid={`product-card-media-${product.id}`}
                >
                  {product.mainImageUrl ? (
                    <img src={product.mainImageUrl} alt="" className="admin-product-card__image" />
                  ) : (
                    <span className="admin-product-card__placeholder" aria-hidden="true">
                      Sin imagen
                    </span>
                  )}
                </Link>

                <div className="admin-product-card__body">
                  <div
                    className="admin-product-card__price"
                    data-testid={`product-supplier-cost-${product.id}`}
                  >
                    {supplierCost != null ? eur.format(supplierCost) : '—'}
                    <span className="admin-product-card__price-label">Proveedor</span>
                  </div>
                  <StatusBadge status={product.status} />
                </div>

                <div className="admin-product-card__actions">
                  <Link
                    to={`/products/${product.id}`}
                    className="btn btn-outline-primary admin-touch-btn"
                    data-testid={`btn-edit-${product.id}`}
                  >
                    Ver
                  </Link>
                  <Button
                    variant="outline-danger"
                    className="admin-touch-btn"
                    onClick={() => setToDelete(product)}
                    data-testid={`btn-delete-${product.id}`}
                  >
                    Eliminar
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && !error && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      <ProductFormModal
        show={showCreate}
        onHide={() => setShowCreate(false)}
        categories={categories}
        onSuccess={(product) => {
          setShowCreate(false);
          navigate(`/products/${product.id}`);
        }}
      />

      <Modal show={toDelete !== null} onHide={() => setToDelete(null)} fullscreen="sm-down">
        <Modal.Header closeButton>
          <Modal.Title>Eliminar producto</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteError && <Alert variant="danger">{deleteError}</Alert>}
          ¿Está seguro de que desea eliminar &quot;{toDelete?.name}&quot;?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setToDelete(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={deleting}
            onClick={handleDelete}
            data-testid="btn-confirm-delete"
          >
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProductsPage;
