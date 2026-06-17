describe('Admin Products Panel', () => {
  const productName = `E2E Admin Product ${Date.now()}`;
  const sku = `E2E-SKU-${Date.now()}`;

  it('lists products with filters and supports full CRUD lifecycle', () => {
    cy.visit('/products');
    cy.get('[data-testid="btn-new-product"]').should('be.visible');

    // Create product
    cy.get('[data-testid="btn-new-product"]').click();
    cy.get('[data-testid="modal-create-product"]').should('be.visible');
    cy.get('[data-testid="input-product-name"]').type(productName);
    cy.get('[data-testid="input-product-description"]').type('Created by Cypress E2E');
    cy.get('[data-testid="btn-modal-save"]').click();

    // Land on detail page (Draft)
    cy.url().should('match', /\/products\/\d+$/);
    cy.contains('h1', productName);
    cy.get('[data-testid="status-badge"]').should('contain.text', 'Draft');

    // Activate disabled without active variant
    cy.get('[data-testid="btn-activate"]').should('be.disabled');

    // Add active variant
    cy.get('[data-testid="btn-add-variant"]').click();
    cy.get('[data-testid="modal-variant"]').should('be.visible');
    cy.get('[data-testid="input-variant-sku"]').type(sku);
    cy.get('[data-testid="input-variant-price"]').clear().type('59.99');
    cy.get('[data-testid="btn-variant-save"]').click();
    cy.get('[data-testid="variants-table"]').should('contain.text', sku);

    // Activate product
    cy.get('[data-testid="btn-activate"]').should('not.be.disabled').click();
    cy.get('[data-testid="status-badge"]').should('contain.text', 'Active');

    // Add image
    cy.get('[data-testid="btn-add-image"]').click();
    cy.get('[data-testid="input-image-url"]').type('https://i.imgur.com/1twoaDy.jpeg');
    cy.get('[data-testid="input-image-alt"]').type('E2E image');
    cy.get('[data-testid="btn-add-image"]').click();
    cy.get('[data-testid="images-manager"]').should('contain.text', 'E2E image');

    // Back to list — search filter
    cy.contains('← Back to Products').click();
    cy.url().should('include', '/products');
    cy.get('[data-testid="filter-search"]').clear().type(productName);
    cy.get('[data-testid="products-table"]').should('contain.text', productName);

    // Soft-delete from list
    cy.get('[data-testid="products-table"] tbody tr')
      .contains(productName)
      .parents('tr')
      .find('button')
      .contains('Delete')
      .click();
    cy.get('[data-testid="btn-confirm-delete"]').click();

    // Product removed from default list (soft-deleted)
    cy.get('[data-testid="products-table"]').should('not.contain.text', productName);
  });

  it('shows activate error when trying via API guard (draft without variant)', () => {
    const draftName = `E2E Draft Only ${Date.now()}`;

    cy.visit('/products');
    cy.get('[data-testid="btn-new-product"]').click();
    cy.get('[data-testid="input-product-name"]').type(draftName);
    cy.get('[data-testid="btn-modal-save"]').click();

    cy.get('[data-testid="btn-activate"]').should('be.disabled');
    cy.contains('Add an active variant to enable activation').should('be.visible');

    // Cleanup via API
    cy.url().then((url) => {
      const id = url.split('/').pop();
      cy.request('DELETE', `${Cypress.env('API_URL')}/api/admin/products/${id}`);
    });
  });
});
