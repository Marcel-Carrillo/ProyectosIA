import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { productService } from '../../services/productService';
import { Product } from '../../types/product';
import ProductGrid from '../../components/storefront/ProductGrid';
import Pagination from '../../components/storefront/Pagination';

const PAGE_SIZE = 20;

const SORT_KEYS = [
  { key: 'newest', sort: 'createdAt', order: 'desc' },
  { key: 'oldest', sort: 'createdAt', order: 'asc' },
  { key: 'nameAZ', sort: 'name', order: 'asc' },
  { key: 'nameZA', sort: 'name', order: 'desc' },
] as const;

const CatalogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const { t } = useTranslation('catalog');

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
      setError(t('error.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [page, categoryId, search, sort, order, t]);

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
    <div>
      <section className="storefront-hero">
        <div className="storefront-hero__inner">
          <p className="storefront-hero__eyebrow storefront-animate-fade-in">{t('hero.eyebrow')}</p>
          <h1 className="storefront-hero__title storefront-animate-fade-in" style={{ animationDelay: '80ms' }}>
            {t('hero.title')}
          </h1>
          <p className="storefront-hero__subtitle storefront-animate-fade-in" style={{ animationDelay: '160ms' }}>
            {t('hero.subtitle')}
          </p>
        </div>
      </section>

      <section className="storefront-toolbar">
        <div className="storefront-toolbar__inner">
          <div className="storefront-toolbar__filters" aria-hidden="true" />
          <div className="storefront-toolbar__tools">
            <form onSubmit={handleSearch} className="storefront-toolbar__search" role="search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" />
              </svg>
              <input
                type="search"
                className="storefront-toolbar__input"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('toolbar.searchPlaceholder')}
                aria-label={t('toolbar.searchLabel')}
              />
            </form>
            <select
              className="storefront-toolbar__sort"
              value={currentSortValue}
              onChange={handleSort}
              aria-label={t('toolbar.sortLabel')}
            >
              {SORT_KEYS.map((opt) => (
                <option key={`${opt.sort}:${opt.order}`} value={`${opt.sort}:${opt.order}`}>
                  {t(`sort.${opt.key}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="storefront-catalog">
        {error && (
          <div className="storefront-alert" role="alert">
            {error}
          </div>
        )}

        {!isLoading && !error && products.length > 0 && (
          <p className="storefront-catalog__count">
            {t('pieces', { count: total })}
          </p>
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
      </section>
    </div>
  );
};

export default CatalogPage;
