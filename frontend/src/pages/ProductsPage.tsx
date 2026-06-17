import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Table, Button, Alert, Modal } from 'react-bootstrap';
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
      .getAll()
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
      setError('Unable to load products. Please try again later.');
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
    <Container fluid className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Products</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)} data-testid="btn-new-product">
          New product
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
          No products found.
        </Alert>
      )}

      {!loading && !error && products.length > 0 && (
        <>
          <div className="d-md-none admin-card-list" data-testid="products-card-list">
            {products.map((product) => (
              <div
                key={product.id}
                className="admin-card-row"
                data-testid={`product-card-row-${product.id}`}
              >
                <div className="admin-card-row__header">
                  {product.mainImageUrl ? (
                    <img
                      src={product.mainImageUrl}
                      alt={product.name}
                      className="admin-card-row__thumb"
                    />
                  ) : (
                    <span className="admin-card-row__thumb d-flex align-items-center justify-content-center bg-light text-muted">
                      —
                    </span>
                  )}
                  <div className="flex-grow-1">
                    <div className="fw-semibold">
                      <Link to={`/products/${product.id}`}>{product.name}</Link>
                    </div>
                    <div className="admin-card-row__meta">
                      {categories.find((c) => c.id === product.categoryId)?.name ?? '—'}
                    </div>
                    <StatusBadge status={product.status} />
                  </div>
                </div>
                <div className="admin-card-row__actions">
                  <Link
                    to={`/products/${product.id}`}
                    className="btn btn-outline-primary admin-touch-btn"
                    data-testid={`btn-edit-${product.id}`}
                  >
                    Edit
                  </Link>
                  <Button
                    variant="outline-danger"
                    className="admin-touch-btn"
                    onClick={() => setToDelete(product)}
                    data-testid={`btn-delete-${product.id}`}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Table hover responsive className="d-none d-md-table" data-testid="products-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Category</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} data-testid={`product-row-${product.id}`}>
                  <td>
                    {product.mainImageUrl ? (
                      <img
                        src={product.mainImageUrl}
                        alt={product.name}
                        style={{ width: 32, height: 32, objectFit: 'cover' }}
                      />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <Link to={`/products/${product.id}`}>{product.name}</Link>
                  </td>
                  <td>
                    <code>{product.slug}</code>
                  </td>
                  <td>
                    <StatusBadge status={product.status} />
                  </td>
                  <td>{categories.find((c) => c.id === product.categoryId)?.name ?? '—'}</td>
                  <td>
                    <Link
                      to={`/products/${product.id}`}
                      className="btn btn-sm btn-outline-primary me-2"
                      data-testid={`btn-edit-${product.id}`}
                    >
                      Edit
                    </Link>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => setToDelete(product)}
                      data-testid={`btn-delete-${product.id}`}
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
          <Modal.Title>Delete product</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteError && <Alert variant="danger">{deleteError}</Alert>}
          Are you sure you want to delete &quot;{toDelete?.name}&quot;?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setToDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={deleting}
            onClick={handleDelete}
            data-testid="btn-confirm-delete"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ProductsPage;
