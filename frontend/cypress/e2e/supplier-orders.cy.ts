describe('Supplier orders', () => {
  const API = Cypress.env('API_URL') ?? 'http://localhost:3000';

  it('lists supplier orders, generates from customer order, and updates status', () => {
    cy.viewport(1280, 800);
    const address = {
      fullName: 'E2E Supplier User',
      streetLine1: 'Test St',
      city: 'Malaga',
      province: 'Malaga',
      postalCode: '29001',
      country: 'Spain',
    };

    cy.exec(
      `node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.productVariant.update({where:{id:1},data:{supplierId:3,supplierCost:24.99,supplierReference:'E2E-SUP'}}).finally(()=>p.\\$disconnect())"`,
      { cwd: '../backend' }
    );

    cy.request('POST', `${API}/api/admin/customer-orders`, {
      customerId: 6,
      items: [{ productVariantId: 1, quantity: 1 }],
      shippingAddressSnapshot: address,
      billingAddressSnapshot: address,
    }).then((createRes) => {
      const orderId = createRes.body.data.id;
      const orderNumber = createRes.body.data.orderNumber;

      cy.request('PATCH', `${API}/api/admin/customer-orders/${orderId}/status`, {
        status: 'Paid',
        paymentStatus: 'Paid',
      });

      cy.request('POST', `${API}/api/admin/customer-orders/${orderId}/supplier-orders`).then(
        (genRes) => {
          expect([200, 201]).to.include(genRes.status);
          const supplierOrderId = genRes.body.data[0].id;
          const supplierOrderNumber = genRes.body.data[0].supplierOrderNumber;

          cy.visit('/supplier-orders');
          cy.contains(supplierOrderNumber).click();
          cy.get('[data-testid="supplier-order-status-control"]').should('be.visible');
          cy.get('[data-testid="select-supplier-order-status"]').select('Requested');
          cy.get('[data-testid="btn-save-supplier-status"]').click();
          cy.get('[data-testid="detail-badge-supplier-order"]').should('contain.text', 'Requested');

          cy.visit(`/customer-orders/${orderId}`);
          cy.contains(supplierOrderNumber).should('be.visible');
          cy.contains(orderNumber).should('be.visible');

          cy.exec(
            `node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{await p.supplierOrderItem.deleteMany({where:{supplierOrderId:${supplierOrderId}}});await p.supplierOrder.delete({where:{id:${supplierOrderId}}});await p.customerOrderItem.deleteMany({where:{customerOrderId:${orderId}}});await p.customerOrder.delete({where:{id:${orderId}}});await p.productVariant.update({where:{id:1},data:{supplierId:null,supplierCost:null,supplierReference:null}});})().finally(()=>p.\\$disconnect())"`,
            { cwd: '../backend', failOnNonZeroExit: false }
          );
        }
      );
    });
  });
});
