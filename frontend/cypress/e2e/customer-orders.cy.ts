describe('Customer orders', () => {
  const assertNoSupplierFields = () => {
    cy.get('body').invoke('text').should('not.match', /supplierCost/i);
    cy.get('body').invoke('text').should('not.match', /supplierReference/i);
    cy.get('body').invoke('text').should('not.match', /supplierId/i);
  };

  beforeEach(() => {
    cy.loginAdmin();
  });

  it('lists orders and updates all three status dimensions on detail page', () => {
    cy.viewport(1280, 800);
    const address = {
      fullName: 'E2E User',
      streetLine1: 'Test St',
      city: 'Malaga',
      province: 'Malaga',
      postalCode: '29001',
      country: 'Spain',
    };

    cy.adminApi({
      method: 'POST',
      url: '/api/admin/customer-orders',
      body: {
        customerId: 6,
        items: [{ productVariantId: 1, quantity: 1 }],
        shippingAddressSnapshot: address,
        billingAddressSnapshot: address,
      },
    }).then((res) => {
      expect(res.status).to.eq(201);
      const orderId = res.body.data.id;
      const orderNumber = res.body.data.orderNumber;

      cy.visit('/customer-orders');
      cy.get('[data-testid="order-search"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="order-date-from"]').should('exist');
      cy.get('[data-testid="order-date-to"]').should('exist');
      assertNoSupplierFields();
      cy.get(`[data-testid="order-link-${orderId}"]`).click();
      cy.get('[data-testid="order-status-timeline"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="order-status-control"]').should('be.visible');
      assertNoSupplierFields();

      cy.get('[data-testid="select-order-status"]').select('Paid');
      cy.get('[data-testid="select-payment-status"]').select('Paid');
      cy.get('[data-testid="select-fulfillment-status"]').select('Processing');
      cy.get('[data-testid="btn-save-status"]').click();
      cy.get('[data-testid="detail-badge-order"]', { timeout: 10000 }).should('contain.text', 'Paid');
      cy.get('[data-testid="detail-badge-payment"]').should('contain.text', 'Paid');
      cy.get('[data-testid="detail-badge-fulfillment"]').should('contain.text', 'Processing');

      cy.exec(
        `node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.customerOrder.delete({where:{id:${orderId}}}).finally(()=>p.\\$disconnect())"`,
        { cwd: '../backend', failOnNonZeroExit: false }
      );
    });
  });

  it('is usable at tablet and mobile width without supplier fields', () => {
    cy.viewport(768, 1024);
    cy.visit('/customer-orders');
    cy.get('[data-testid="order-search"]', { timeout: 10000 }).should('be.visible');
    assertNoSupplierFields();
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.be.lte(doc.documentElement.clientWidth + 1);
    });

    cy.viewport(360, 640);
    cy.visit('/customer-orders');
    cy.get('[data-testid="order-search"]', { timeout: 10000 }).should('be.visible');
    assertNoSupplierFields();
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.be.lte(doc.documentElement.clientWidth + 1);
    });
  });
});
