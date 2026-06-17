import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { productService } from '../../services/productService';
import { Product } from '../../types/product';
import ProductGrid from '../../components/storefront/ProductGrid';
import Pagination from '../../components/storefront/Pagination';

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { label: 'Newest', sort: 'createdAt', order: 'desc' },
  { label: 'Oldest', sort: 'createdAt', order: 'asc' },
  { label: 'Name A–Z', sort: 'name', order: 'asc' },
  { label: 'Name Z–A', sort: 'name', order: 'desc' },
];

const CatalogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');

  useEffect(() => {
    setSearchInput(searchParams.get('search') || '');
  }, [searchParams]);

  const pageRaw = parseInt(searchParams.get('page') || '1', 10);
  const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;
  const categoryIdRaw = parseInt(searchParams.get('categoryId') || '', 10);
  const categoryId = Number.isNaN(categoryIdRaw) ? undefined : categoryIdRaw;
  const search = searchParams.get('search') || undefined;
  const sortRaw = searchParams.get('sort');
  const orderRaw = searchParams.get('order');
  const sort = (sortRaw === 'name' || sortRaw === 'createdAt' ? sortRaw : 'createdAt') as 'name' | 'createdAt';
  const order = (orderRaw === 'asc' || orderRaw === 'desc' ? orderRaw : 'desc') as 'asc' | 'desc';

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await productService.getAll({
        status: 'Active',
        page,
        pageSize: PAGE_SIZE,
        categoryId,
        search,
        sort,
        order,
      });
      setProducts(res.data.items);
      setTotal(res.data.total);
    } catch {
      setError('Unable to load products. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [page, categoryId, search, sort, order]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const updateParams = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v !== undefined) next.set(k, v);
      else next.delete(k);
    });
    next.set('page', '1');
    setSearchParams(next);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ search: searchInput || undefined });
  };

  const handleSort = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [s, o] = e.target.value.split(':');
    updateParams({ sort: s, order: o });
  };

  const handlePageChange = (p: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentSortValue = `${sort}:${order}`;

  return (
    <div className="storefront-section">
      <div className="storefront-container">
        <div className="storefront-controls">
          <form onSubmit={handleSearch} className="storefront-controls__search" role="search">
            <div className="storefront-controls__search-row">
              <input
                type="search"
                className="storefront-controls__input"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products…"
                aria-label="Search products by name"
              />
              <button type="submit" className="storefront-controls__submit">
                Search
              </button>
            </div>
          </form>

          <select
            className="storefront-controls__sort"
            value={currentSortValue}
            onChange={handleSort}
            aria-label="Sort products"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={`${opt.sort}:${opt.order}`} value={`${opt.sort}:${opt.order}`}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              background: 'var(--color-error-bg)',
              color: 'var(--color-error)',
              marginBottom: 24,
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {error}
          </div>
        )}

        <ProductGrid
          products={products}
          isLoading={isLoading}
          isEmpty={!isLoading && !error && products.length === 0}
        />

        {!isLoading && !error && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
};

export default CatalogPage;
