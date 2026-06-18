describe('Customer orders', () => {
  const API = Cypress.env('API_URL') ?? 'http://localhost:3000';

  it('lists orders and updates status on detail page', () => {
    cy.viewport(1280, 800);
    const address = {
      fullName: 'E2E User',
      streetLine1: 'Test St',
      city: 'Malaga',
      province: 'Malaga',
      postalCode: '29001',
      country: 'Spain',
    };

    cy.request('POST', `${API}/api/admin/customer-orders`, {
      customerId: 6,
      items: [{ productVariantId: 1, quantity: 1 }],
      shippingAddressSnapshot: address,
      billingAddressSnapshot: address,
    }).then((res) => {
      expect(res.status).to.eq(201);
      const orderId = res.body.data.id;
      const orderNumber = res.body.data.orderNumber;

      cy.visit('/customer-orders');
      cy.get('[data-testid="order-search"]').should('be.visible');
      cy.contains(orderNumber).click();
      cy.get('[data-testid="order-status-control"]').should('be.visible');
      cy.get('[data-testid="select-payment-status"]').select('Paid');
      cy.get('[data-testid="btn-save-status"]').click();
      cy.get('[data-testid="detail-badge-payment"]').should('contain.text', 'Paid');

      cy.exec(
        `node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.customerOrder.delete({where:{id:${orderId}}}).finally(()=>p.\\$disconnect())"`,
        { cwd: '../backend', failOnNonZeroExit: false }
      );
    });
  });
});
