---

description: Frontend development standards, best practices, and conventions for the women's fashion ecommerce React application including component patterns, state management, UI/UX guidelines, and testing practices
globs: ["frontend/src/**/*.{js,jsx,ts,tsx}", "frontend/cypress/**/*.{ts,js}", "frontend/tsconfig.json", "frontend/cypress.config.ts", "frontend/package.json"]
alwaysApply: true
-----------------

# Frontend Project Configuration and Best Practices

## Table of Contents

* [Overview](#overview)
* [Technology Stack](#technology-stack)

  * [Core Technologies](#core-technologies)
  * [UI Framework](#ui-framework)
  * [State Management & Data Flow](#state-management--data-flow)
  * [Testing Framework](#testing-framework)
  * [Development Tools](#development-tools)
* [Project Structure](#project-structure)
* [Coding Standards](#coding-standards)

  * [Language and Naming Conventions](#language-and-naming-conventions)
  * [Component Conventions](#component-conventions)
  * [State Management](#state-management)
  * [Service Layer Architecture](#service-layer-architecture)
* [UI/UX Standards](#uiux-standards)

  * [Bootstrap Integration](#bootstrap-integration)
  * [Form Handling](#form-handling)
  * [Navigation Patterns](#navigation-patterns)
  * [Accessibility](#accessibility)
* [Testing Standards](#testing-standards)

  * [End-to-End Testing with Cypress](#end-to-end-testing-with-cypress)
  * [Test Organization](#test-organization)
* [Configuration Standards](#configuration-standards)

  * [TypeScript Configuration](#typescript-configuration)
  * [ESLint Configuration](#eslint-configuration)
  * [Environment Configuration](#environment-configuration)
* [Performance Best Practices](#performance-best-practices)

  * [Component Optimization](#component-optimization)
  * [Bundle Optimization](#bundle-optimization)
  * [API Efficiency](#api-efficiency)
* [Development Workflow](#development-workflow)

  * [Git Workflow](#git-workflow)
  * [Development Scripts](#development-scripts)
  * [Code Quality](#code-quality)
* [Migration Strategy](#migration-strategy)

  * [TypeScript Migration](#typescript-migration)
  * [Component Modernization](#component-modernization)

---

## Overview

This document outlines the best practices, conventions, and standards used in the women's fashion ecommerce frontend application. These practices ensure code consistency, maintainability, and optimal development experience.

The frontend supports an online store for women's fashion and accessories. The initial business model is supplier-fulfilled ecommerce:

* Customers browse products and variants.
* Customers place orders through the online store.
* Store administrators process supplier orders in the background.
* Suppliers may ship products directly to customers.
* The frontend must support future evolution to internal stock, hybrid fulfillment, multiple suppliers, and supplier automation.

## Technology Stack

### Core Technologies

* **React 18.3.1**: Modern React with functional components and hooks
* **TypeScript 4.9.5**: For type safety and better development experience
* **Create React App 5.0.1**: Build tooling and development server
* **React Router DOM 6.23.1**: Client-side routing and navigation

### UI Framework

* **Bootstrap 5.3.3**: CSS framework for responsive design
* **React Bootstrap 2.10.2**: Bootstrap components for React
* **React Bootstrap Icons 1.11.4**: Icon library
* **React DatePicker 6.9.0**: Date input components

### State Management & Data Flow

* **React Hooks**: useState, useEffect for local state management
* **React Beautiful DND 13.1.1**: Drag and drop functionality
* **Axios**: HTTP client for API communication

### Testing Framework

* **Cypress 14.4.1**: End-to-end testing
* **Jest**: Unit testing via Create React App
* **React Testing Library**: Component testing utilities

### Development Tools

* **ESLint**: Code linting with React-specific rules
* **TypeScript**: Static type checking
* **Web Vitals**: Performance monitoring

## Project Structure

```
frontend/
├── public/                 # Static assets
├── src/
│   ├── components/        # Reusable UI components
│   ├── services/          # API service layer
│   ├── pages/             # Page components
│   ├── assets/            # Images, fonts, static resources
│   ├── App.tsx            # Main application component
│   ├── index.tsx          # Application entry point
│   └── index.css          # Global styles
├── cypress/
│   └── e2e/               # End-to-end test files
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── cypress.config.ts      # Cypress configuration
```

## Coding Standards

### Naming Conventions

* **Component Naming**: Use PascalCase for React components (e.g., `ProductCard`, `OrderDetails`, `SupplierDashboard`)
* **Variable Naming**: Use camelCase for variables and functions (e.g., `productId`, `handleSubmit`, `fetchProducts`)
* **Constants Naming**: Use UPPER_SNAKE_CASE for constants (e.g., `MAX_PRODUCTS_PER_PAGE`, `API_BASE_URL`)
* **Type/Interface Naming**: Use PascalCase for types and interfaces (e.g., `ProductData`, `OrderProps`, `IProductService`)
* **File Naming**: Use PascalCase for component files (e.g., `ProductCard.tsx`, `OrderDetails.tsx`) and camelCase for utility files (e.g., `productService.js`, `apiUtils.ts`)
* **CSS Class Naming**: Use kebab-case for CSS classes (e.g., `product-card`, `order-details`)
* **Hook Naming**: Use camelCase starting with "use" prefix (e.g., `useProduct`, `useOrderData`, `useFormValidation`)

**Examples:**

```typescript
// Good: All in English
import React, { useState, useEffect } from 'react';

type ProductCardProps = {
    product: Product;
    index: number;
    onClick: (product: Product) => void;
};

const ProductCard: React.FC<ProductCardProps> = ({ product, index, onClick }) => {
    const [isLoading, setIsLoading] = useState(false);
    
    // Handle product card click event
    const handleCardClick = () => {
        onClick(product);
    };
    
    return (
        <div className="product-card" onClick={handleCardClick}>
            {/* Component JSX */}
        </div>
    );
};

// Avoid: Non-English comments or names
const TarjetaProducto: React.FC<PropsTarjetaProducto> = ({ producto, indice, alHacerClic }) => {
    const [estaCargando, setEstaCargando] = useState(false);
    
    // Manejar evento de clic en la tarjeta de producto
    const manejarClicTarjeta = () => {
        alHacerClic(producto);
    };
    
    return (
        <div className="tarjeta-producto" onClick={manejarClicTarjeta}>
            {/* JSX del componente */}
        </div>
    );
};
```

**Error Messages and Console Logs:**

```typescript
// Good: English error messages
catch (error) {
    console.error('Failed to fetch products:', error);
    setError('Unable to load products. Please try again later.');
}

// Avoid: Non-English messages
catch (error) {
    console.error('Error al obtener productos:', error);
    setError('No se pudieron cargar los productos. Por favor, inténtelo de nuevo más tarde.');
}
```

**Service Layer Examples:**

```typescript
// Good: English naming in services
export const productService = {
    getAllProducts: async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/products`);
            return response.data;
        } catch (error) {
            console.error('Error fetching products:', error);
            throw error;
        }
    }
};

// Avoid: Non-English naming
export const servicioProductos = {
    obtenerTodosLosProductos: async () => {
        try {
            const respuesta = await axios.get(`${API_BASE_URL}/products`);
            return respuesta.data;
        } catch (error) {
            console.error('Error al obtener productos:', error);
            throw error;
        }
    }
};
```

### Component Conventions

#### Functional Components

* **Always use functional components** with hooks instead of class components
* Use **TypeScript for new components** when possible
* Keep **JavaScript for legacy components** until migration

```typescript
// Preferred - TypeScript functional component
import React, { useState, useEffect } from 'react';

type Product = {
    id: number;
    name: string;
    status: 'Draft' | 'Active' | 'Inactive' | 'Archived';
};

const Products: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    // Component logic
};
```

#### Component Props

* **Define TypeScript interfaces** for component props when using TypeScript
* Use **destructuring** for props
* Include **default values** where appropriate

```typescript
type ProductCardProps = {
    product: Product;
    index: number;
    onClick: (product: Product) => void;
};

const ProductCard: React.FC<ProductCardProps> = ({ product, index, onClick }) => {
    // Component implementation
};
```

### State Management

#### Local State with Hooks

* Use **useState** for component-level state
* Use **useEffect** for side effects and data fetching
* **Extract custom hooks** for reusable stateful logic

```javascript
const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'Draft'
});

const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
        ...prev,
        [name]: value
    }));
};
```

#### Loading and Error States

* **Always handle loading states** for async operations
* **Implement error handling** with user-friendly messages
* **Use React Bootstrap Alert** components for feedback

```javascript
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');
const [success, setSuccess] = useState('');

// In async function
try {
    setLoading(true);
    const data = await apiCall();
    setSuccess('Operation completed successfully');
} catch (error) {
    setError('Error message: ' + error.message);
} finally {
    setLoading(false);
}
```

### Service Layer Architecture

#### API Services

* **Centralize API calls** in service files
* Use **axios** for HTTP requests
* **Export service objects** with grouped methods
* **Handle errors at service level** when appropriate

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

export const productService = {
    getAllProducts: async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/products`);
            return response.data;
        } catch (error) {
            console.error('Error fetching products:', error);
            throw error;
        }
    },
    
    updateProduct: async (id, productData) => {
        try {
            const response = await axios.put(`${API_BASE_URL}/products/${id}`, productData);
            return response.data;
        } catch (error) {
            console.error('Error updating product:', error);
            throw error;
        }
    }
};
```

Recommended ecommerce service files:

```text
productService.ts          # public storefront → /api/public/products
adminProductService.ts     # admin panel CRUD → /api/admin/products (+ variants/images)
categoryService.ts
supplierService.ts
customerService.ts
customerOrderService.ts
supplierOrderService.ts
shipmentService.ts
returnRequestService.ts
refundService.ts
```

#### Admin product panel patterns

* **Separate services**: Storefront uses `productService.ts` (`/api/public/*`). Admin uses `adminProductService.ts` (`/api/admin/*`). Never call admin endpoints from storefront pages.
* **Admin components** live under `frontend/src/components/admin/` (`ProductFilters`, `VariantTable`, `ImageManager`, `ProductFormModal`, `StatusBadge`).
* **Pages**: `ProductsPage` (list + filters + URL sync + pagination) and `ProductDetailPage` (general form, status lifecycle, variants, images).
* **Error mapping**: Use `mapProductError()` for backend codes (`PRODUCT_REQUIRES_ACTIVE_VARIANT`, `PRODUCT_SLUG_CONFLICT`, etc.).
* **Supplier fields**: Admin UI must never render `supplierId`, `supplierReference`, or `supplierCost` on variants (even if backend stores them).
* **Shared UI**: Re-export storefront `Pagination` from `frontend/src/components/Pagination.tsx` for admin list pages.
* **Testing**: RTL tests mock `adminProductService`; Cypress spec at `frontend/cypress/e2e/products.cy.ts`.

#### Admin customer panel patterns

* **Service**: `frontend/src/services/customerService.ts` calls `/api/admin/customers`. Exports `customerService` object plus `mapCustomerError`, `extractCustomerErrorMessage`, `extractCustomerErrorCode`.
* **Types**: `frontend/src/types/customer.ts` — `Customer`, `CustomerAddress`, `AddressType = 'Shipping' | 'Billing'`, input/response types, `CustomerAdminApiError`.
* **Admin components** under `frontend/src/components/admin/`: `CustomerFormModal`, `CustomerAddressesSection`, `CustomerAddressFormModal`.
* **Page**: `CustomersPage` — debounced search (400 ms via `useRef` + `setTimeout`), URL search-param sync (`useSearchParams`), dual render (mobile `<Card>` list + desktop `<Table>`).
* **Debounced search pattern**: clear previous timer with `useRef<ReturnType<typeof setTimeout>>`, fire after 400 ms, cancel on component unmount.
* **Address ownership guard**: address endpoints always include `:customerId` in the URL (`/api/admin/customers/:customerId/addresses/:addressId`); backend enforces ownership via `findFirst({ id, customerId })`.
* **Delete guard (409 CUSTOMER_HAS_ORDERS)**: delete confirmation modal hides the "Confirm delete" button when backend returns `CUSTOMER_HAS_ORDERS`; only "Close" remains.
* **PII rule**: never log or display `email`/`phone` in error messages or console; use only `customerId` and operation name in any debug output.
* **Testing**: RTL tests mock `customerService` and child modals; use `findBy*` queries for all async assertions.

#### Admin customer-order panel patterns

* **Service**: `frontend/src/services/customerOrderService.ts` calls `/api/admin/customer-orders` (list, get, create, updateStatus, generateSupplierOrders).
* **Types**: `frontend/src/types/customerOrder.ts` — three status dimensions, `AddressSnapshot`, `CustomerOrderQueryParams` (includes optional `createdFrom`/`createdTo`).
* **Pages**: `CustomerOrdersPage` (debounced search, status filters, date-range inputs, URL sync, dual card/table render); `CustomerOrderDetailPage` (items, addresses, totals, linked supplier orders/refunds/returns).
* **Components**: `OrderStatusControl` (three independent selects, PATCH only changed fields); `OrderStatusTimeline` (derived milestones from `createdAt`, `paidAt`, `cancelledAt`, `updatedAt`).
* **Security**: never render `supplierCost`, `supplierReference`, or supplier notes in customer-order UI.
* **Mobile**: refund/return modals use `fullscreen="sm-down"`; primary actions use `admin-touch-btn` (44px min tap target).
* **Test IDs**: `order-search`, `order-date-from`, `order-date-to`, `order-link-{id}`, `order-status-timeline`, `order-status-control`, `btn-save-status`.
* **Testing**: RTL page tests under `frontend/src/pages/__tests__/CustomerOrdersPage.test.tsx` and `CustomerOrderDetailPage.test.tsx`; Cypress `frontend/cypress/e2e/customer-orders.cy.ts`.

## UI/UX Standards

### Bootstrap Integration

* Use **React Bootstrap components** instead of plain Bootstrap
* **Import Bootstrap CSS** in the main App component
* Follow **Bootstrap responsive grid system** with Container, Row, Col

```javascript
import { Container, Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';
```

### Form Handling

* Use **controlled components** for form inputs
* Implement **real-time validation** where appropriate
* **Disable submit buttons** during form submission
* **Clear form state** after successful submission

```javascript
<Form onSubmit={handleSubmit}>
    <Form.Group className="mb-3">
        <Form.Label>Product name *</Form.Label>
        <Form.Control
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
        />
    </Form.Group>
    <Button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save'}
    </Button>
</Form>
```

### Navigation Patterns

* Use **React Router** for all navigation
* **Implement breadcrumbs** with back navigation
* Use **programmatic navigation** with useNavigate hook

```javascript
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

// Navigation examples
<Button variant="link" onClick={() => navigate('/')}>
    ← Back to Dashboard
</Button>
```

Recommended frontend routes:

```text
/products
/products/:id
/categories
/suppliers
/customers
/customer-orders
/customer-orders/:id
/supplier-orders
/supplier-orders/:id
/shipments
/return-requests
/refunds
```

### Accessibility

* Include **aria-label** attributes for interactive elements
* Use **semantic HTML** elements
* Ensure **keyboard navigation** support
* Provide **alternative text** for images

```javascript
<Form.Control 
    type="text" 
    placeholder="Search by product name" 
    aria-label="Search products by name"
/>
```

### Responsive breakpoints and tap targets

The storefront and admin catalog surfaces target three widths:

| Breakpoint | Width | Usage |
|------------|-------|--------|
| Mobile baseline | 360px (CSS `max-width: 575.98px`) | Phone-first layout, full-width controls |
| Tablet | 768px (Bootstrap `md`) | Two-column PDP, multi-column admin filters |
| Desktop | ≥992px (Bootstrap `lg`) | Full admin tables, 4-column storefront grid |

**Storefront** (`frontend/src/styles/storefront.css`):

* Product grid: 2 / 3 / 4 columns at default / 768px / 1200px.
* Catalog search and sort stack full-width on mobile; controls use 44px height on small viewports.
* Header icon buttons use `.storefront-header__icon-btn` (min 44×44px hit area).
* Product detail uses `.storefront-pdp-grid` (1 column below 768px, 2 columns at ≥768px).

**Admin** (`frontend/src/styles/admin.css` + Bootstrap grid):

* Below `md`, product and variant lists render as **stacked cards** (`.admin-card-list` / `.admin-card-row`); full tables use `d-none d-md-table`.
* Filters use mobile-first columns (`xs={12}` for primary fields).
* Modals use React Bootstrap `fullscreen="sm-down"` for create/edit/delete flows on phones.
* Action buttons on mobile use `.admin-touch-btn` (min-height 44px).

**Testing:** Cypress specs in `frontend/cypress/e2e/responsive.cy.ts` assert no horizontal document overflow at 360, 768, and 1280px viewports.

## Testing Standards

### End-to-End Testing with Cypress

* **Test user workflows** rather than implementation details
* Use **data-testid** attributes for reliable element selection
* **Organize tests by feature** (products.cy.ts, orders.cy.ts)
* **Include API testing** alongside UI testing

```typescript
describe('Products API - Update', () => {
    beforeEach(() => {
        cy.window().then((win) => {
            win.localStorage.clear();
        });
    });

    it('should update a product successfully', () => {
        const updateData = {
            name: 'Updated Test Product',
            status: 'Active'
        };

        cy.request({
            method: 'PUT',
            url: `${API_URL}/products/${testProductId}`,
            body: updateData
        }).then((response) => {
            expect(response.status).to.eq(200);
            expect(response.body.data.name).to.eq(updateData.name);
        });
    });
});
```

### Test Organization

* **Group related tests** with describe blocks
* **Use descriptive test names** that explain the expected behavior
* **Test both success and error scenarios**
* **Include edge cases** and validation testing

Recommended Cypress test files:

```text
products.cy.ts
categories.cy.ts
suppliers.cy.ts
customerOrders.cy.ts
supplierOrders.cy.ts
shipments.cy.ts
returns.cy.ts
refunds.cy.ts
```

Recommended test scenarios:

```text
create product
update product
list products
filter products by status
create customer order
create supplier order from customer order
update supplier order status
register shipment
create return request
create refund
```

## Configuration Standards

### TypeScript Configuration

* Enable **strict mode** for type checking
* Use **path mapping** with "@/*" for cleaner imports
* Include **both Cypress and Node types**
* Configure **ES5 target** for broader compatibility

```json
{
    "compilerOptions": {
        "strict": true,
        "baseUrl": ".",
        "paths": {
            "@/*": ["src/*"]
        },
        "types": ["cypress", "node"]
    }
}
```

### ESLint Configuration

* Extend **React App** configuration (`react-app`, `react-app/jest`)
* CI job **`frontend-quality`** runs: `npx eslint src --ext .ts,.tsx` — must pass before merge
* Include **Jest / Testing Library rules** for test files

#### Testing Library rules (test files)

The project enforces `testing-library/prefer-find-by`. When asserting async UI:

```typescript
// ✅ Use findBy* (returns a Promise)
expect(await screen.findByTestId('order-link-1')).toBeInTheDocument();
expect(await screen.findByText(/unable to load/i)).toBeInTheDocument();
fireEvent.click(await screen.findByTestId('btn-save'));

// ❌ Do NOT combine waitFor + getBy* for the same assertion
await waitFor(() => expect(screen.getByTestId('order-link-1')).toBeInTheDocument());
```

* Reserve `waitFor` for non-query assertions (e.g. mock call counts after debounce + `jest.advanceTimersByTime`).
* Reference passing tests: `src/pages/__tests__/ProductsPage.test.tsx`, `ShipmentDetailPage.test.tsx`.
* Run locally before commit: `cd frontend && npx eslint src --ext .ts,.tsx`

Test-file overrides in `package.json` disable `no-container` and `no-node-access` for supplier-field DOM checks.

### Environment Configuration

* Use **environment variables** for API URLs
* **Separate configurations** for development and production
* **Configure Cypress** with environment-specific settings

```javascript
// cypress.config.ts
export default defineConfig({
    e2e: {
        baseUrl: 'http://localhost:3001',
        env: {
            API_URL: 'http://localhost:3000'
        }
    }
});
```

Recommended frontend environment variables:

```text
REACT_APP_API_BASE_URL
REACT_APP_ENVIRONMENT
```

## Performance Best Practices

### Component Optimization

* **Lazy load** components when appropriate
* **Memoize expensive calculations** with useMemo
* **Avoid unnecessary re-renders** with useCallback
* **Extract reusable logic** into custom hooks

### Bundle Optimization

* **Tree shaking** enabled through Create React App
* **Code splitting** at route level
* **Optimize images** and static assets
* **Monitor bundle size** with build tools

### API Efficiency

* **Implement proper error handling** for network requests
* **Cache API responses** where appropriate
* **Use loading states** to improve perceived performance
* **Batch API calls** when possible
* **Paginate product, customer order, supplier order, shipment, return, and refund lists**

## Development Workflow

* **Feature Branches**: Develop features in separate branches, adding descriptive suffix "-frontend" to allow working in parallel and avoid conflicts or collisions
* **Descriptive Commits**: Write descriptive commit messages in English
* **Code Review**: Code review before merging
* **Small Branches**: Keep branches small and focused

Recommended branch names:

```text
feature/product-catalog-frontend
feature/customer-orders-frontend
feature/supplier-orders-frontend
feature/shipment-tracking-frontend
feature/returns-refunds-frontend
```

### Development Scripts

```bash
npm start          # Development server
npm test           # Run unit tests
npm run build      # Production build
npm run cypress:open    # Open Cypress test runner
npm run cypress:run     # Run Cypress tests headlessly
```

### Code Quality

* **ESLint validation** before commits
* **TypeScript compilation** without errors
* **All tests passing** before deployment
* **Performance monitoring** with Web Vitals

## Migration Strategy

### TypeScript Migration

* **Gradual migration** from JavaScript to TypeScript
* **New components in TypeScript** by default
* **Maintain existing JavaScript** components until planned refactor
* **Add types incrementally** to existing code

### Component Modernization

* **Functional components** over class components
* **Hooks** instead of lifecycle methods
* **React Bootstrap** components for consistency
* **Responsive design** principles throughout

This document serves as the foundation for maintaining code quality and consistency across the women's fashion ecommerce frontend application. All team members should follow these practices to ensure a maintainable and scalable codebase.

---

## Storefront (Public-Facing) UI

### Route Namespace

The application has two isolated route trees:

| Namespace | Layout | Purpose |
|---|---|---|
| `/catalog`, `/catalog/:id` | `StorefrontLayout` | Public storefront (visible to customers) |
| `/products`, `/categories`, `/suppliers`, … | Admin `Layout` | Admin panel |

The root `/` redirects to `/catalog`. Admin routes are unchanged and use no storefront components.

### Folder Structure

```
frontend/src/
├── components/
│   └── storefront/          # Storefront-only UI components
│       ├── StorefrontLayout.tsx
│       ├── StorefrontHeader.tsx
│       ├── StorefrontFooter.tsx
│       ├── CategoryNav.tsx
│       ├── LanguageSwitcher.tsx
│       ├── PriceTag.tsx
│       ├── ProductCard.tsx
│       ├── ProductGrid.tsx
│       ├── ProductGallery.tsx
│       ├── VariantSelector.tsx
│       └── Pagination.tsx
├── constants/
│   └── storefrontCategories.ts  # STOREFRONT_CATEGORY_ORDER, DB name → i18n key map
├── hooks/
│   └── useStorefrontCategories.ts  # Fetches + maps categories; returns { links, getHref, isLoading }
├── pages/
│   └── storefront/          # Storefront page components (lazy-loaded)
│       ├── CatalogPage.tsx
│       ├── ProductPage.tsx
│       └── ContentPage.tsx  # Static content pages at /pages/:slug (uses pages namespace)
├── styles/
│   ├── tokens.css           # CSS custom properties (design tokens)
│   └── storefront.css       # Storefront utility classes
└── types/
    ├── product.ts           # Product, ProductVariant, ProductImage types
    ├── category.ts          # Category type
    └── index.ts             # Re-exports
```

### Design Token Convention

Design tokens live in `frontend/src/styles/tokens.css` as CSS custom properties on `:root`. They are imported before Bootstrap in `index.tsx` and apply globally. Storefront components consume them via `var(--token-name)`.

Token categories:

| Prefix | Example | Purpose |
|---|---|---|
| `--color-*` | `--color-near-black` | Neutral palette |
| `--font-family-*` | `--font-family-body` | Typography |
| `--font-size-*` | `--font-size-sm` | Type scale |
| `--font-weight-*` | `--font-weight-regular` | Weights |
| `--spacing-*` | `--spacing-4` | Whitespace scale |
| `--radius-*` | `--radius-sm` | Border radii |
| `--shadow-*` | `--shadow-card` | Elevation |

Tokens are a layer **on top of** Bootstrap, not a replacement. Use Bootstrap grid and utilities; override visual style via tokens.

### Security Invariant

Supplier fields (`supplierId`, `supplierReference`, `supplierCost`) must **never** appear in any storefront component output. They are excluded at the Prisma select layer on the server and are absent from all `ProductVariant` types.

### Storefront Header Layout

The header bar uses a **3-column CSS Grid** (`grid-template-columns: 1fr auto 1fr`):

| Column | Element | Class |
|--------|---------|-------|
| 1 (`1fr`) | Invisible layout placeholder | `.storefront-header__bar-start` |
| 2 (`auto`) | Logo link | `.storefront-header__logo` |
| 3 (`1fr`) | Language switcher + icons | `.storefront-header__actions` |

The `CategoryNav` lives in a **separate row** (`.storefront-header__nav-row`) below the bar — it is not a grid child of the bar.

**Critical rule:** `.storefront-header__bar-start` must **never** be set to `display: none` globally. Removing it from the grid flow causes the logo to collapse into column 1, off-centering it. The correct pattern:

```css
/* mobile: hide the placeholder (2-column mobile grid, no centering needed) */
.storefront-header__bar-start { display: none; }

/* desktop: restore it so the 3-column grid centres the logo */
@media (min-width: 768px) {
  .storefront-header__bar-start { display: block; }
}
```

### `useStorefrontCategories` hook

`frontend/src/hooks/useStorefrontCategories.ts` fetches categories from `GET /api/public/categories`, maps each DB name to a canonical i18n key via `categoryNameToKey()` (defined in `frontend/src/constants/storefrontCategories.ts`), and translates the label with `t('nav.category.<key>', { ns: 'common' })`.

Return shape:
```typescript
{
  links: Array<{ key: string; label: string; href: string }>,
  isLoading: boolean,
  getHref: (key: string) => string,
}
```

Category order is controlled by `STOREFRONT_CATEGORY_ORDER` in `storefrontCategories.ts`. To add a new category: add the DB name to `STOREFRONT_CATEGORY_DB_NAMES`, add the i18n key to `common.json` under `nav.category`, and include the key in `STOREFRONT_CATEGORY_ORDER`.

### Storefront Testing

Add Cypress test file: `cypress/e2e/storefront.cy.ts`

Recommended scenarios:
- Catalog page loads with product cards
- Category nav filters grid
- Search updates URL and results
- Product detail shows gallery, price, variant selector
- No supplier fields in HTML source
- Admin routes unaffected (layout isolation)

---

## Internationalisation (i18n) — Storefront Only

### Scope

i18n is enabled **only for the public storefront** (routes under `StorefrontLayout`). The admin panel remains hardcoded in Spanish. Admin components must never call `useTranslation`.

### Library and Initialisation

```bash
npm install i18next@^23 react-i18next@^14 i18next-browser-languagedetector@^7 --legacy-peer-deps
```

Singleton initialised in `frontend/src/i18n/index.ts` and imported **once** at the top of `frontend/src/index.tsx` (before `<App />`):

```typescript
import './i18n/index';
```

Key settings:
- `fallbackLng: 'es'` — Spanish is the default; UI renders Spanish if no stored preference.
- `supportedLngs: ['es', 'en']`
- `detection.lookupLocalStorage: 'mavile.lang'` — preference persisted across sessions.
- `defaultNS: 'common'`, `keySeparator: '.'`

### Locale File Structure

```
frontend/src/i18n/
├── index.ts                 # init singleton
└── locales/
    ├── es/
    │   ├── common.json      # header, nav, footer, pagination, oauth
    │   ├── auth.json        # fields, login, register
    │   ├── catalog.json     # hero, toolbar, sort, error, pieces count
    │   ├── cart.json        # title, count, empty, item, summary
    │   ├── pages.json       # static content pages (shipping, returns, size-guide, contact, our-story, materials, sustainability, press)
    │   ├── product.json     # (placeholder — extend for ProductPage)
    │   ├── checkout.json    # (placeholder — extend for CheckoutPage)
    │   └── account.json     # (placeholder — extend for AccountPage)
    └── en/
        └── … (mirrors es/)
```

### Usage in Components

Use the `useTranslation` hook with the relevant namespace:

```typescript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation('catalog');
// ...
<h1>{t('hero.title')}</h1>
<p>{t('pieces', { count: total })}</p>   // pluralisation
```

Rules:
- Always pass the **namespace** as first argument to `useTranslation` (omit only for `'common'`).
- Never place UI strings in module-level constants — they cannot be reactive to language changes. Use `t()` inside the component body or compute a local object inside the component.
- `PriceTag` uses `i18n.language` to select an `Intl.NumberFormat` locale (`'es-ES'` / `'en-IE'`) while always formatting in EUR.
- `StorefrontLayout` syncs `document.documentElement.lang` via `useEffect` on `i18n.language`.

### Language Switcher

`LanguageSwitcher` lives in `frontend/src/components/storefront/LanguageSwitcher.tsx` and is rendered inside `StorefrontHeader`. It calls `i18n.changeLanguage('es'|'en')` and sets `aria-pressed` on the active flag button.

CSS lives in `frontend/src/styles/storefront.css` under `.storefront-lang-switcher`.

### Testing i18n-aware Components

Use `renderWithI18n` from `frontend/src/test-utils/renderWithI18n.tsx`. It wraps the component with an isolated `I18nextProvider` and defaults to `lng: 'en'`:

```typescript
import { renderWithI18n } from '../../../test-utils/renderWithI18n';

renderWithI18n(<CartPage />, { lng: 'en' });  // English assertions
renderWithI18n(<CartPage />, { lng: 'es' });  // Spanish assertions
```

Do **not** render i18n-aware storefront components with plain `render()` from RTL — translations will be missing and tests will assert on key paths.

### Static Content Pages (`/pages/:slug`)

`ContentPage` (`frontend/src/pages/storefront/ContentPage.tsx`) renders static informational pages routed at `/pages/:slug`. The `slug` parameter maps to a key in the `pages` i18n namespace. Supported slugs: `shipping`, `returns`, `size-guide`, `contact`, `our-story`, `materials`, `sustainability`, `press`.

Each page key in `pages.json` has the shape:
```json
{
  "shipping": {
    "title": "...",
    "sections": [
      { "heading": "...", "body": "..." }
    ]
  }
}
```

Footer links point to these routes. To add a new static page: add the slug to `App.tsx` (the `/pages/:slug` route already catches it), add the content to `es/pages.json` and `en/pages.json`.

### Adding New Strings

1. Add the key to both `es/<namespace>.json` and `en/<namespace>.json`.
2. If it's a new namespace, add the import and resource entry in `frontend/src/i18n/index.ts` and `renderWithI18n.tsx`.
3. Use `t('key', { count })` for plural keys (i18next pluralisation: `key_one` / `key_other`).

---

## Stack Decisions

### CRA vs. Vite

**Decision:** Keep Create React App 5.0.1. **Vite migration is deferred until explicitly approved.**

Rationale:
- All existing tooling (Cypress config, Jest, `react-scripts`) is CRA-based.
- Migration requires updating `tsconfig.json`, `vite.config.ts`, adjusting import aliases, and re-testing the full suite.
- No performance bottleneck has been identified that justifies the migration risk at this stage.

If Vite is reconsidered, create a dedicated change proposal through the OpenSpec workflow before proceeding.

## Stripe.js / Elements Integration

### Package Installation

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js --legacy-peer-deps
```

The `--legacy-peer-deps` flag is required due to React 19 peer dependency constraints in the current CRA setup.

### Loading Stripe

Always load Stripe via `loadStripe` from `@stripe/stripe-js` — never instantiate directly. Load only once per checkout session, using the publishable key returned by `GET /api/public/payments/config`:

```typescript
import { loadStripe } from '@stripe/stripe-js';
import { getStripeConfig } from '../services/paymentService';

const { publishableKey } = await getStripeConfig();
const stripePromise = loadStripe(publishableKey);
```

Store `stripePromise` in component state — do not recreate it on every render.

### Elements Provider

Wrap the payment step in `<Elements>` with `clientSecret` from the checkout API response:

```tsx
<Elements stripe={stripePromise} options={{ clientSecret: order.clientSecret }}>
  <PaymentForm orderNumber={order.orderNumber} onSuccess={...} onError={...} />
</Elements>
```

`clientSecret` comes from the backend's `POST /api/public/checkout` response. It must not be logged or stored beyond the current session.

### Two-Step Checkout

Checkout is split into two sequential steps:

1. **Details step** — address + guest info + coupon → calls `POST /api/public/checkout` → receives `clientSecret`
2. **Payment step** — renders `<PaymentElement>` → calls `stripe.confirmPayment` with `redirect: 'if_required'`

Never merge these steps or call `stripe.confirmPayment` in the same handler that creates the order.

### Payment Confirmation Pattern

```typescript
const { error, paymentIntent } = await stripe.confirmPayment({
  elements,
  confirmParams: {
    return_url: `${window.location.origin}/order-confirmation/${orderNumber}`,
  },
  redirect: 'if_required',
});
```

- If `error` is set → display `error.message`, allow retry
- If `paymentIntent.status === 'succeeded'` → navigate to confirmation
- If redirect occurred → Stripe.js handles it automatically (3DS)

### Payment Status Polling

After confirmation, navigate to the order confirmation page with `state: { paymentStatus: 'processing' }`. The confirmation page polls `GET /api/public/account/orders` every 2 seconds (max 30 seconds) for `paymentStatus === 'Paid'`:

- On `Paid` → show success alert, stop polling
- On `Failed` → show error alert, stop polling
- On timeout (15 attempts × 2s = 30s) → show fallback warning with link to order history

### Security Constraints

- `STRIPE_SECRET_KEY` must **never** appear in frontend code, environment variables, or API responses
- Only `publishableKey` from `GET /api/public/payments/config` may be used on the frontend
- `stripePaymentIntentId` and `stripeChargeId` are backend-internal — they must not appear in any API response consumed by the frontend

### Testing Stripe Components

Mock `@stripe/react-stripe-js` in unit tests — never use real Stripe.js in Jest:

```typescript
jest.mock('@stripe/react-stripe-js', () => ({
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => mockUseStripe(),
  useElements: () => mockUseElements(),
}));
```

Mock `confirmPayment` to test success, error, and network-failure paths independently.
