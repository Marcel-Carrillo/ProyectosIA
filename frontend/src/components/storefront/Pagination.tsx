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
        <span key={`ellipsis-${idx}`} style={{ padding: '0 8px', color: 'var(--color-mid)' }}>
          …
        </span>
      );
    }
    items.push(
      <button
        key={p}
        onClick={() => onPageChange(p)}
        aria-label={`Page ${p}`}
        aria-current={p === currentPage ? 'page' : undefined}
        style={{
          minWidth: 36,
          height: 36,
          border: p === currentPage ? '1px solid var(--color-near-black)' : '1px solid var(--color-light)',
          background: p === currentPage ? 'var(--color-near-black)' : 'var(--color-white)',
          color: p === currentPage ? 'var(--color-white)' : 'var(--color-near-black)',
          cursor: 'pointer',
          fontSize: 'var(--font-size-sm)',
          margin: '0 2px',
        }}
      >
        {p}
      </button>
    );
    return items;
  };

  return (
    <nav
      aria-label="Pagination"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 40 }}
    >
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
        style={{
          height: 36,
          padding: '0 12px',
          border: '1px solid var(--color-light)',
          background: 'var(--color-white)',
          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          opacity: currentPage === 1 ? 0.4 : 1,
          fontSize: 'var(--font-size-sm)',
        }}
      >
        ←
      </button>

      {visiblePages.map((p, idx) =>
        renderPage(p, visiblePages[idx - 1] ?? null, idx)
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        style={{
          height: 36,
          padding: '0 12px',
          border: '1px solid var(--color-light)',
          background: 'var(--color-white)',
          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
          opacity: currentPage === totalPages ? 0.4 : 1,
          fontSize: 'var(--font-size-sm)',
        }}
      >
        →
      </button>
    </nav>
  );
};

export default Pagination;
