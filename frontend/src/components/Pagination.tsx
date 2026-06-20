import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visiblePages = pages.filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2
  );

  const renderPage = (p: number, prev: number | null, idx: number) => {
    const items = [];
    if (prev !== null && p - prev > 1) {
      items.push(
        <span key={`ellipsis-${idx}`} className="storefront-pagination__ellipsis">
          …
        </span>
      );
    }
    items.push(
      <button
        key={p}
        type="button"
        onClick={() => onPageChange(p)}
        aria-label={`Page ${p}`}
        aria-current={p === currentPage ? 'page' : undefined}
        className={`storefront-pagination__btn${p === currentPage ? ' storefront-pagination__btn--active' : ''}`}
      >
        {p}
      </button>
    );
    return items;
  };

  return (
    <nav className="storefront-pagination" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className="storefront-pagination__btn"
      >
        ←
      </button>

      {visiblePages.map((p, idx) =>
        renderPage(p, visiblePages[idx - 1] ?? null, idx)
      )}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className="storefront-pagination__btn"
      >
        →
      </button>
    </nav>
  );
};

export default Pagination;
