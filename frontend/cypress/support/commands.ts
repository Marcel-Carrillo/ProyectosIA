const apiBase = (): string => Cypress.env('API_URL') ?? 'http://localhost:3000';

Cypress.Commands.add('loginAdmin', () => {
  const email = Cypress.env('ADMIN_EMAIL') ?? 'admin@example.com';
  const password = Cypress.env('ADMIN_PASSWORD') ?? 'AdminPass1';

  cy.session('admin-ui', () => {
    cy.visit('/admin/login');
    cy.get('#admin-email').clear().type(email);
    cy.get('#admin-password').clear().type(password);
    cy.contains('button', 'Sign in').click();
    cy.url({ timeout: 15000 }).should('not.include', '/admin/login');
  });
});

Cypress.Commands.add('adminApi', (options: Partial<Cypress.RequestOptions>) => {
  const email = Cypress.env('ADMIN_EMAIL') ?? 'admin@example.com';
  const password = Cypress.env('ADMIN_PASSWORD') ?? 'AdminPass1';

  return cy
    .request('POST', `${apiBase()}/api/admin/auth/login`, { email, password })
    .then((loginRes) => {
      const token = loginRes.body.data.accessToken as string;
      const url = options.url ?? '';
      const resolvedUrl = url.startsWith('http') ? url : `${apiBase()}${url}`;

      return cy.request({
        ...options,
        url: resolvedUrl,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    });
});

export {};

declare global {
  namespace Cypress {
    interface Chainable {
      loginAdmin(): Chainable<void>;
      adminApi(options: Partial<Cypress.RequestOptions>): Chainable<Cypress.Response<unknown>>;
    }
  }
}
