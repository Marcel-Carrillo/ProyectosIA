describe('Suppliers', () => {
  const supplierName = `E2E Supplier ${Date.now()}`;

  it('supports full CRUD lifecycle with status controls', () => {
    cy.viewport(1280, 800);
    cy.visit('/suppliers');
    cy.get('[data-testid="btn-new-supplier"]').should('be.visible');

    // Create
    cy.get('[data-testid="btn-new-supplier"]').click();
    cy.get('[data-testid="modal-supplier-form"]').should('be.visible');
    cy.get('[data-testid="input-supplier-name"]').type(supplierName);
    cy.get('[data-testid="input-supplier-contact-email"]').type('e2e@test.com');
    cy.get('[data-testid="btn-modal-save"]').click();
    cy.get('[data-testid="modal-supplier-form"]').should('not.exist');

    // Appears in the list
    cy.get('[data-testid="suppliers-table"]').should('contain.text', supplierName);

    // Search
    cy.get('[data-testid="filter-search"]').clear().type(supplierName);
    cy.get('[data-testid="suppliers-table"]').should('contain.text', supplierName);
    cy.get('[data-testid="filter-search"]').clear();

    // Edit -> Blocked
    cy.get('[data-testid="suppliers-table"]')
      .contains(supplierName)
      .parents('tr')
      .find('[data-testid^="btn-edit-"]')
      .click();
    cy.get('[data-testid="select-supplier-status"]').select('Blocked');
    cy.get('[data-testid="btn-modal-save"]').click();
    cy.get('[data-testid="modal-supplier-form"]').should('not.exist');

    // Filter by Blocked
    cy.get('[data-testid="filter-status"]').select('Blocked');
    cy.get('[data-testid="suppliers-table"]').should('contain.text', supplierName);

    // Deactivate (soft-delete)
    cy.get('[data-testid="suppliers-table"]')
      .contains(supplierName)
      .parents('tr')
      .find('[data-testid^="btn-deactivate-"]')
      .click();
    cy.get('[data-testid="btn-confirm-deactivate"]').click();

    // Now Inactive
    cy.get('[data-testid="filter-status"]').select('Inactive');
    cy.get('[data-testid="suppliers-table"]').should('contain.text', supplierName);

    // Cleanup via API (capture id from the edit button)
    cy.get('[data-testid="suppliers-table"]')
      .contains(supplierName)
      .parents('tr')
      .find('[data-testid^="btn-edit-"]')
      .invoke('attr', 'data-testid')
      .then((tid) => {
        const id = tid?.replace('btn-edit-', '');
        cy.request('DELETE', `${Cypress.env('API_URL')}/api/admin/suppliers/${id}`);
      });
  });

  const noOverflow = (w: number, h: number) => {
    cy.viewport(w, h);
    cy.visit('/suppliers');
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.eq(doc.documentElement.clientWidth);
    });
  };

  it('has no horizontal overflow at 360px (mobile)', () => {
    noOverflow(360, 800);
    cy.get('[data-testid="suppliers-card-list"]').should('be.visible');
    cy.get('[data-testid="suppliers-table"]').should('not.be.visible');
  });

  it('has no horizontal overflow at 768px (tablet)', () => {
    noOverflow(768, 1024);
  });

  it('has no horizontal overflow at 1280px (desktop)', () => {
    noOverflow(1280, 800);
    cy.get('[data-testid="suppliers-table"]').should('be.visible');
    cy.get('[data-testid="suppliers-card-list"]').should('not.be.visible');
  });
});
