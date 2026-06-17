const VIEWPORTS = [
  { label: 'mobile', width: 360, height: 740 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'desktop', width: 1280, height: 800 },
] as const;

const assertNoHorizontalOverflow = () => {
  cy.document().then((doc) => {
    const el = doc.documentElement;
    expect(el.scrollWidth).to.be.lte(el.clientWidth + 1);
  });
};

describe('Responsive layout', () => {
  VIEWPORTS.forEach(({ label, width, height }) => {
    context(`${label} (${width}x${height})`, () => {
      beforeEach(() => {
        cy.viewport(width, height);
      });

      it('storefront catalog has no horizontal overflow', () => {
        cy.visit('/catalog', {
          headers: { Accept: 'text/html' },
        });
        cy.get('.storefront-grid, .storefront-empty, .storefront-skeleton').should('exist');
        assertNoHorizontalOverflow();
      });

      it('admin products list is usable', () => {
        cy.visit('/products', {
          headers: { Accept: 'text/html' },
        });
        cy.get('[data-testid="filter-search"]').should('be.visible');
        assertNoHorizontalOverflow();
        if (width < 768) {
          cy.get('[data-testid="products-card-list"], [data-testid="empty-state"], [data-testid="loading-state"]')
            .should('exist');
        } else {
          cy.get('[data-testid="products-table"], [data-testid="empty-state"], [data-testid="loading-state"]')
            .should('exist');
        }
      });
    });
  });
});
