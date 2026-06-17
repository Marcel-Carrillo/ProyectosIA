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

      it('storefront product detail has no horizontal overflow', () => {
        cy.request('GET', `${Cypress.env('API_URL') || 'http://localhost:3000'}/api/public/products?status=Active&pageSize=1`).then(
          (res) => {
            const id = res.body.data.items[0]?.id;
            if (!id) return;
            cy.visit(`/catalog/${id}`, { headers: { Accept: 'text/html' } });
            cy.get('.storefront-pdp-grid, .storefront-pdp-skeleton, .storefront-empty').should('exist');
            assertNoHorizontalOverflow();
          },
        );
      });

      it('admin products list is usable', () => {
        cy.visit('/products', {
          headers: { Accept: 'text/html' },
        });
        cy.get('[data-testid="filter-search"]').should('be.visible');
        assertNoHorizontalOverflow();
        if (width < 992) {
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
