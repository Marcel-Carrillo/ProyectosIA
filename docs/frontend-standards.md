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
│   ├── App.js             # Main application component
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
productService.ts
categoryService.ts
supplierService.ts
customerService.ts
customerOrderService.ts
supplierOrderService.ts
shipmentService.ts
returnRequestService.ts
refundService.ts
```

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

* Extend **React App** configuration
* Include **Jest rules** for testing
* **Automatic code formatting** and error detection
* **Consistent code style** across the project

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
