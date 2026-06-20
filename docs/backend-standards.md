---
description: Backend development standards, best practices, and conventions for the women's fashion ecommerce Node.js/TypeScript/Express application including Domain-Driven Design, SOLID principles, architecture patterns, API design, and testing practices
globs: ["backend/src/**/*.ts", "backend/prisma/**/*.{prisma,ts}", "backend/jest.config.js", "backend/tsconfig.json", "backend/serverless.yml", "backend/package.json"]
alwaysApply: true
---

# Backend Project Standards and Best Practices

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
  - [Core Technologies](#core-technologies)
  - [Database & ORM](#database--orm)
  - [Testing Framework](#testing-framework)
  - [Development Tools](#development-tools)
- [Architecture Overview](#architecture-overview)
  - [Domain-Driven Design (DDD)](#domain-driven-design-ddd)
  - [Layered Architecture](#layered-architecture)
  - [Project Structure](#project-structure)
- [Domain-Driven Design Principles](#domain-driven-design-principles)
  - [Entities](#entities)
  - [Value Objects](#value-objects)
  - [Aggregates](#aggregates)
  - [Repositories](#repositories)
  - [Domain Services](#domain-services)
  - [Additional Recommendations](#additional-recommendations)
- [SOLID and DRY Principles](#solid-and-dry-principles)
  - [Single Responsibility Principle (SRP)](#single-responsibility-principle-srp)
  - [Open/Closed Principle (OCP)](#openclosed-principle-ocp)
  - [Liskov Substitution Principle (LSP)](#liskov-substitution-principle-lsp)
  - [Interface Segregation Principle (ISP)](#interface-segregation-principle-isp)
  - [Dependency Inversion Principle (DIP)](#dependency-inversion-principle-dip)
  - [DRY (Don't Repeat Yourself)](#dry-dont-repeat-yourself)
- [Coding Standards](#coding-standards)
  - [Language and Naming Conventions](#language-and-naming-conventions)
  - [TypeScript Usage](#typescript-usage)
  - [Error Handling](#error-handling)
  - [Validation Patterns](#validation-patterns)
  - [Logging Standards](#logging-standards)
- [API Design Standards](#api-design-standards)
  - [REST Endpoints](#rest-endpoints)
  - [Request/Response Patterns](#requestresponse-patterns)
  - [Error Response Format](#error-response-format)
  - [CORS Configuration](#cors-configuration)
- [Database Patterns](#database-patterns)
  - [Prisma Schema](#prisma-schema)
  - [Migrations](#migrations)
  - [Repository Pattern](#repository-pattern)
- [Testing Standards](#testing-standards)
  - [Unit Testing](#unit-testing)
  - [Integration Testing](#integration-testing)
  - [Test Coverage Requirements](#test-coverage-requirements)
  - [Mocking Standards](#mocking-standards)
- [Performance Best Practices](#performance-best-practices)
  - [Database Query Optimization](#database-query-optimization)
  - [Async/Await Patterns](#asyncawait-patterns)
  - [Error Handling Performance](#error-handling-performance)
- [Security Best Practices](#security-best-practices)
  - [Input Validation](#input-validation)
  - [Environment Variables](#environment-variables)
  - [Dependency Injection](#dependency-injection)
- [Development Workflow](#development-workflow)
  - [Git Workflow](#git-workflow)
  - [Development Scripts](#development-scripts)
  - [Code Quality](#code-quality)
- [Serverless Deployment](#serverless-deployment)
  - [AWS Lambda Configuration](#aws-lambda-configuration)
  - [Serverless Framework](#serverless-framework)

---

## Overview

This document outlines the best practices, conventions, and standards used in the women's fashion ecommerce backend application. The backend follows Domain-Driven Design (DDD) principles and implements a layered architecture to ensure code consistency, maintainability, and scalability.

The project is an online store for women's fashion and accessories. The initial business model is supplier-fulfilled ecommerce: customers place orders through the online store, while store administrators process the corresponding supplier orders in the background. Suppliers may ship products directly to customers.

## Technology Stack

### Core Technologies
- **Node.js**: Runtime environment
- **TypeScript**: Type-safe development with strict mode
- **Express.js**: Web application framework
- **Prisma**: Modern ORM for database access

### Database & ORM
- **PostgreSQL**: Relational database (Docker container)
- **Prisma Client**: Type-safe database client
- **Prisma Migrate**: Database migration tool

### Testing Framework
- **Jest**: Testing framework with TypeScript support
- **Coverage Threshold**: 90% for branches, functions, lines, and statements
- **Test Location**: `__tests__` directories and `.test.ts` files

### Development Tools
- **ESLint**: Code linting
- **TypeScript Compiler**: Type checking and compilation
- **Serverless Framework**: AWS Lambda deployment support

## Architecture Overview

### Domain-Driven Design (DDD)

Domain-Driven Design is a methodology that focuses on modeling software according to business logic and domain knowledge. By centering development on a deep understanding of the domain, DDD facilitates the creation of complex systems.

**Benefits:**
- **Improved Communication**: Promotes a common language between developers and domain experts, improving communication and reducing interpretation errors.
- **Clear Domain Models**: Helps build models that accurately reflect business rules and processes.
- **High Maintainability**: By dividing the system into subdomains, it facilitates maintenance and software evolution.

### Layered Architecture

The backend follows a layered DDD architecture:

**Presentation Layer** (`src/presentation/`)
- Controllers handle HTTP requests/responses
- Routes define API endpoints
- Controllers use services from Application layer

**Application Layer** (`src/application/`)
- Services contain business logic and orchestration
- Validator handles input validation
- Services use repositories from Domain layer

**Domain Layer** (`src/domain/`)
- Models define core business entities (Product, ProductVariant, Category, Customer, CustomerOrder, Supplier, SupplierOrder, Shipment, ReturnRequest, Refund, etc.)
- Repository interfaces define data access contracts
- Pure business logic without external dependencies

**Infrastructure Layer** (implicit)
- Prisma ORM handles database operations
- Repository implementations (via Prisma) satisfy domain interfaces

### Project Structure

```
backend/
├── src/
│   ├── domain/
│   │   ├── models/          # Domain entities
│   │   └── repositories/    # Repository interfaces
│   ├── application/
│   │   ├── services/        # Business logic services
│   │   └── validator.ts     # Input validation
│   ├── presentation/
│   │   └── controllers/     # HTTP request handlers
│   ├── infrastructure/
│   │   ├── logger.ts        # Logging utilities
│   │   └── prismaClient.ts  # Prisma client setup
│   ├── routes/              # Express route definitions
│   ├── middleware/          # Express middleware
│   ├── index.ts             # Application entry point
│   └── lambda.ts            # AWS Lambda handler
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── migrations/          # Database migrations
├── test-utils/
│   ├── builders/            # Test data builders
│   └── mocks/               # Mock helpers
├── jest.config.js           # Jest configuration
├── tsconfig.json            # TypeScript configuration
├── serverless.yml           # Serverless Framework config
└── package.json             # Dependencies and scripts
```

## Domain-Driven Design Principles

### Entities

Entities are objects with a distinct identity that persists over time.

**Before:**
```typescript
// Previously, product data might have been handled as a simple JSON object without methods.
const product = {
     id: 1, name: 'Black midi dress', description: 'Elegant black midi dress', publicPrice: 49.99 
};
```

**After:**
```typescript
export class Product {
     id?: number;
     name: string; 
     description?: string; 
     publicPrice: number; 
     status: string; 

     // Constructor and methods that encapsulate business logic 
     constructor(data: any) { 
        this.id = data.id; 
        this.name = data.name; 
        this.description = data.description; 
        this.publicPrice = data.publicPrice; 
        this.status = data.status; 
        } 
        
        activate(): void { 
            this.status = 'Active'; 
        } 
        
        deactivate(): void { 
            this.status = 'Inactive'; 
        } 
    }
```

**Explanation**: `Product` is an entity because it has a unique identifier (id) that distinguishes it from other products, even if other properties are similar.

**Best Practice**: Entities should encapsulate business logic related to their domain concept and maintain consistency of their internal state.

In this ecommerce project, typical entities include:

Product
ProductVariant
Category
Customer
CustomerOrder
CustomerOrderItem
Supplier
SupplierOrder
SupplierOrderItem
Shipment
ReturnRequest
Refund

### Value Objects

Value Objects describe aspects of the domain without conceptual identity. They are defined by their attributes rather than an identifier.

**Before:**
```typescript
// Handling address information as a simple object 
    const shippingAddress = { 
        street: 'Main Street 10', 
        city: 'Malaga', 
        postalCode: '29001', 
        country: 'Spain' 
    };
```

**After:**
```typescript
export class Address { 
    street: string; 
    city: string; 
    postalCode: string; 
    country: string; 
    
    constructor(data: any) {
         this.street = data.street; 
         this.city = data.city; 
         this.postalCode = data.postalCode; 
         this.country = data.country; 
    } 
}
```

**Explanation**: `Address` can be considered a Value Object because it describes a customer's shipping or billing address without requiring its own identity in the domain model.

Other possible Value Objects in this ecommerce project include:

Money
Address
Sku
ProductSlug
TrackingNumber
SupplierReference
EmailAddress

**Recommendation**: Value Objects should be immutable when possible. They should validate their own consistency and avoid exposing invalid domain states.

Example:

export class Money {
    amount: number;
    currency: string;

    constructor(amount: number, currency: string) {
        if (amount < 0) {
            throw new Error('Money amount cannot be negative');
        }

        this.amount = amount;
        this.currency = currency;
    }
}

### Aggregates

Aggregates are clusters of objects that must be treated as a unit. They have a root entity that enforces invariants and consistency boundaries.

**Before:**
```typescript
// Customer order and order items handled separately without a clear consistency boundary 
    const customerOrder = { id: 1, customerEmail: 'customer@example.com' }; 
    const orderItems = [{ customerOrderId: 1, productVariantId: 10, quantity: 1 }];
```

**After:**
```typescript
export class CustomerOrder {
     id?: number; 
     customerEmail: string; 
     status: string; 
     fulfillmentStatus: string; 
     items: CustomerOrderItem[]; 
     
     constructor(data: any) { 
        this.id = data.id; 
        this.customerEmail = data.customerEmail; 
        this.status = data.status; 
        this.fulfillmentStatus = data.fulfillmentStatus; 
        this.items = data.items?.map((item: any) => new CustomerOrderItem(item)) || []; 
    } 
    
    addItem(item: CustomerOrderItem): void { 
        this.items.push(item); 
    } 
    
    markAsPaid(): void { 
        if (this.status === 'Cancelled') { throw new Error('Cancelled orders cannot be marked as paid'); } this.status = 'Paid'; 
    }
}
```

**Explanation**: `CustomerOrder` acts as an aggregate root that contains CustomerOrderItem entities. Order items only make sense within the context of a customer order.

**Recommendation**: Aggregates should be carefully designed to ensure that all operations within the aggregate boundary maintain consistency.
In this ecommerce project, possible aggregate roots include:
Product, containing ProductVariant
CustomerOrder, containing CustomerOrderItem
SupplierOrder, containing SupplierOrderItem
ReturnRequest, related to one or more returned order items

For supplier-fulfilled ecommerce, it is especially important to keep CustomerOrder and SupplierOrder as separate aggregates because they represent different business processes:

CustomerOrder: what the customer buys from the store.
SupplierOrder: what the store requests from the supplier in the background.

A single CustomerOrder may generate one or more SupplierOrder records.

### Repositories

Repositories provide interfaces for accessing aggregates and entities, encapsulating data access logic.

**Before:**
```typescript
// Direct database access without abstraction 
function getProductById(id: number) { 
    return database.query('SELECT * FROM products WHERE id = ?', [id]); 
}
```

**After:**
```typescript
export interface IProductRepository { 
    findById(id: number): Promise<Product | null>; 
    save(product: Product): Promise<Product>; 
    findAll(): Promise<Product[]>; 
}

export class ProductRepository implements IProductRepository { 
    async findById(id: number): Promise<Product | null> { 
        const data = await prisma.product.findUnique({ where: { id } }); 
        return data ? new Product(data) : null; 
    } 
    
    async save(product: Product): Promise<Product> { 
        // Implementation with Prisma 
    } 
    
    async findAll(): Promise<Product[]> { 
        // Implementation with Prisma 
        return []; 
    } 
}
```

**Explanation**: `ProductRepository` provides a clear interface for accessing product data, encapsulating database access logic.

Other repository interfaces in this ecommerce project may include:

export interface ICustomerOrderRepository {
    findById(id: number): Promise<CustomerOrder | null>;
    save(customerOrder: CustomerOrder): Promise<CustomerOrder>;
    findAll(): Promise<CustomerOrder[]>;
}

export interface ISupplierOrderRepository {
    findById(id: number): Promise<SupplierOrder | null>;
    save(supplierOrder: SupplierOrder): Promise<SupplierOrder>;
    findByCustomerOrderId(customerOrderId: number): Promise<SupplierOrder[]>;
}

**Recommendation**: 
- Develop complete repository interfaces for each entity and aggregate, ensuring all database interactions for those entities pass through the repository.
- Implement repository methods that handle collections of entities, such as lists of products, customer orders, supplier orders, or shipments.
- Use dependency injection to inject Prisma client into repositories.
- Keep Prisma-specific logic in the infrastructure/repository implementation, not in controllers.
- Avoid exposing supplier costs or internal supplier details through customer-facing repository responses.

### Domain Services

Domain Services contain business logic that does not naturally belong to a single entity or value object.

**Before:**
```typescript
// Loose function to handle supplier order creation 
function createSupplierOrdersFromCustomerOrder(customerOrder: any): any[] { 
    return customerOrder.items.map((item: any) => ({ 
        supplierId: item.supplierId, 
        productVariantId: 
        item.productVariantId, 
        quantity: item.quantity 
    })); 
}
```

**After:**
```typescript
export class SupplierOrderService { 
    static createSupplierOrdersFromCustomerOrder(customerOrder: CustomerOrder): SupplierOrder[] { 
        if (customerOrder.status !== 'Paid') { 
            throw new Error('Supplier orders can only be created for paid customer orders'); 
        } 
        // Group customer order items by supplier and create one supplier order per supplier. 
        // // Implementation details depend on the final domain model. 
        return []; 
    } 
}
```

**Explanation**: `SupplierOrderService` encapsulates business logic related to supplier order creation. This logic does not naturally belong only to CustomerOrder or only to SupplierOrder, because it coordinates both concepts.

Other possible Domain Services in this ecommerce project include:

PricingService
FulfillmentService
SupplierOrderService
RefundEligibilityService
ReturnEligibilityService
ShipmentTrackingService

Recommendation: Use Domain Services when business logic coordinates multiple entities or aggregates. Avoid placing orchestration-heavy logic inside controllers.

### Additional Recommendations

**Use of Factories**

Factories are useful in DDD to encapsulate the logic of creating complex objects, ensuring that all created objects comply with domain rules from the moment of creation.

**Recommendation**: Implement factories for the creation of entities and aggregates, especially those that are complex and require specific initial configuration that complies with business rules.

Examples:

export class CustomerOrderFactory {
    static create(data: any): CustomerOrder {
        // Validate required data
        // Build customer order
        // Build customer order items
        // Set initial status
        return new CustomerOrder({
            ...data,
            status: 'PendingPayment',
            fulfillmentStatus: 'NotStarted'
        });
    }
}
export class SupplierOrderFactory {
    static createFromCustomerOrder(customerOrder: CustomerOrder): SupplierOrder[] {
        // Group items by supplier
        // Create one supplier order per supplier
        // Set initial supplier order status
        return [];
    }
}

**Improvement in Relationship Modeling**

Relationships between entities and aggregates must be clear and consistent with business rules.

**Recommendation**: Review and design relationships between ecommerce entities carefully.

Important relationship rules for this project:

A Product may have many ProductVariant records.
A ProductVariant may be associated with one Supplier.
A CustomerOrder may have many CustomerOrderItem records.
A CustomerOrder may generate one or more SupplierOrder records.
A SupplierOrder belongs to one Supplier.
A SupplierOrder may have many SupplierOrderItem records.
A Shipment may be related to a SupplierOrder and/or a CustomerOrder.
A ReturnRequest must be related to the original customer order and affected items.
A Refund must be related to a customer order and payment operation.

**Domain Events Integration**

Domain events are an important part of DDD and can be used to handle side effects of domain operations in a decoupled manner.

**Recommendation**: Implement a domain event system that allows entities and aggregates to publish events that other system components can handle without being tightly coupled to the entities that generate them.

Possible domain events in this ecommerce project:

CustomerOrderCreated
CustomerOrderPaid
SupplierOrderRequested
SupplierOrderConfirmed
SupplierOrderShipped
SupplierOutOfStockReported
ShipmentDelivered
ReturnRequested
RefundProcessed

Domain events can be used later for:

Sending emails.
Updating fulfillment status.
Triggering supplier integrations.
Creating internal notifications.
Updating reporting or analytics.

## SOLID and DRY Principles

### SOLID Principles

SOLID principles are five object-oriented design principles that help create more understandable, flexible, and maintainable systems.

#### Single Responsibility Principle (SRP)

Each class should have a single responsibility or reason to change.

**Before:**
```typescript
// A method that handles multiple responsibilities: validation and data storage
function processProduct(product: any) { 
    if (!product.name || product.name.trim().length === 0) { 
        console.error('Invalid product name'); 
        return; 
    } 
    database.save(product); 
    console.log('Product saved'); 
}
```

**After:**
```typescript
export class Product {
     // The class now only handles logic related to the product 
     validateName(): void { 
        if (!this.name || this.name.trim().length === 0) { 
            throw new Error('Invalid product name'); 
        } 
    } 
} 
export class ProductRepository { 
    async save(product: Product): Promise<Product> { 
        product.validateName(); 
        return await prisma.product.create({ data: product }); 
    } 
}
```

**Explanation**: The `Product` class now has separate methods for validation, while the repository handles data persistence, complying with the single responsibility principle.

**Observation**: Domain models must not directly handle persistence concerns. For example, a `Product` or `CustomerOrder` class should not directly access Prisma.

**Recommendation**: Separate data access logic into a repository layer to adhere more closely to SRP.

#### Open/Closed Principle (OCP)

Software entities should be open for extension but closed for modification.

**Before:**
```typescript
// Direct modification of the class to add functionality 
class CustomerOrder { 
    saveToDatabase() { 
        // code to save to database 
    } 

    // To add new functionality, we modify the class directly 
    sendConfirmationEmail() { 
        // code to send an email 
    } 
}
```

**After:**
```typescript
export class CustomerOrder { 
    saveToDatabase() { 
        // code to save to database 
        } 
    } 
    
    // Extend functionality without modifying the existing class 
    class CustomerOrderWithEmailNotification extends CustomerOrder { 
        sendConfirmationEmail() { 
            // code to send an email 
        } 
    }
```

**Explanation**: The email sending functionality is extended without modifying the original class, keeping the original class closed for modifications but open for extensions.

**Observation**: Application services should avoid directly instantiating many related ecommerce objects such as `CustomerOrder`, `CustomerOrderItem`, `SupplierOrder`, and `SupplierOrderItem` in a rigid way.

**Recommendation**: Use factory methods to create complex entities and aggregates, allowing for easier extension without modifying existing code.

#### Liskov Substitution Principle (LSP)

Objects of a derived class should be replaceable with objects of the base class without altering the program's functionality.

**Before:**
```typescript
// Subclass that cannot completely replace its base class 
class SupplierFulfilledOrder extends CustomerOrder { 
    saveToDatabase() { 
        throw new Error("Supplier fulfilled orders can't be saved."); 
    } 
}
```

**After:**
```typescript
class SupplierFulfilledOrder extends CustomerOrder { saveToDatabase() { 
    // Appropriate implementation that allows supplier-fulfilled orders to be saved 
    console.log("Supplier fulfilled order saved"); 
    // Alternative: Save with supplier fulfillment metadata 
    } 
}
```

**Explanation**: `SupplierFulfilledOrder` now provides an appropriate implementation that respects the base class contract, allowing substitution without errors.

**Observation**: The project should prefer composition over inheritance when modeling ecommerce workflows such as supplier fulfillment, internal stock fulfillment, or hybrid fulfillment.

**Recommendation**: Continue using composition to avoid LSP violations and ensure that any future inheritance structures allow derived classes to substitute their base classes without altering how the program works.

#### Interface Segregation Principle (ISP)

Many specific interfaces are better than a single general interface.

**Before:**
```typescript
// A large interface that small clients don't fully use
interface ProductOperations { 
    save(): void; 
    validate(): void; 
    publish(): void; 
    generateReport(): void; 
    createSupplierOrder(): void; 
}
```

**After:**
```typescript
interface SaveOperation {
    save(): void;
}

interface PublishOperation { 
    publish(): void; 
}

interface ReportOperations {
    generateReport(): void;
}

interface SupplierOrderOperations { 
    createSupplierOrder(): void; 
}

class Product implements SaveOperation, PublishOperation {
    save() {
        // implementation
    }
    
    publish() {
        // implementation
    }
}
```

**Explanation**: Interfaces are segregated into smaller operations, allowing classes to implement only the interfaces they need.

**Observation**: Ecommerce services can grow quickly if product, order, supplier, shipment, return, and refund operations are grouped into large generic interfaces.

**Recommendation**: Define granular interfaces for service classes to ensure they only implement the methods they need.

#### Dependency Inversion Principle (DIP)

High-level modules should not depend on low-level modules; both should depend on abstractions.

**Before:**
```typescript
// Direct dependency on a concrete implementation 
class Product { 
    private database = new PrismaClient(); 

    save() { 
        this.database.product.create({ data: this }); 
    } 
}
```

**After:**
```typescript
interface ProductDatabase { 
    save(product: Product): Promise<Product>; 
} 

class Product { 
    private database: ProductDatabase; 

    constructor(database: ProductDatabase) { 
        this.database = database; 
    } 
    async save(): Promise<Product> { 
        return await this.database.save(this); 
    } 
}
```

**Explanation**: `Product` now depends on an abstraction (ProductDatabase), not a concrete implementation, which facilitates flexibility and code testing.

**Observation**: Domain classes such as `Product`, `CustomerOrder`, or `SupplierOrder` should not directly depend on the concrete `PrismaClient` for database operations.

**Recommendation**: Use dependency injection to invert the dependency, relying on abstractions rather than concrete implementations. Inject `PrismaClient` through repositories or infrastructure services.

### DRY (Don't Repeat Yourself)

The DRY principle focuses on reducing duplication in code. Each piece of knowledge should have a single, unambiguous, and authoritative representation within a system.

**Before:**
```typescript
// Repeated code to validate product price in multiple functions 
function saveProduct(product: Product) { 
    if (product.publicPrice <= 0) { 
        throw new Error('Product price must be greater than zero'); 
    } 
    // save logic 
} 

function updateProduct(product: Product) { 
    if (product.publicPrice <= 0) { 
        throw new Error('Product price must be greater than zero'); 
    } 
    // update logic 
}
```

**After:**
```typescript
export class Product { validatePrice(): void { 
    if (this.publicPrice <= 0) { 
        throw new Error('Product price must be greater than zero'); 
    } 
} 

async save(): Promise<Product> { 
    this.validatePrice(); 
    // save logic 
    } 
    
async update(): Promise<Product> { 
    this.validatePrice(); 
    // update logic 
    } 
}
```

**Explanation**: Product price validation is centralized in a single `validatePrice` method, eliminating code duplication in the save and update functions.

**Observation**: Repeated logic may appear when saving products, product variants, customer orders, supplier orders, shipments, returns, and refunds.

**Recommendation**: Abstract common validation, persistence, and status transition logic into reusable functions, value objects, factories, or domain services when appropriate.

## Coding Standards

### Naming Conventions

- **Variable Naming**: Use camelCase for variables and functions (e.g., productId, findProductById)
- **Class Naming**: Use PascalCase for classes and interfaces (e.g., Product, ProductRepository)
- **Constants Naming**: Use UPPER_SNAKE_CASE for constants (e.g., MAX_PRODUCTS_PER_PAGE)
- **Type Naming**: Use PascalCase for types and interfaces (e.g., ProductData, IProductRepository)
- **File Naming**: Use camelCase for file names (e.g., productService.ts, productController.ts)

**Examples:**

```typescript
// Good: All in English 
export class ProductRepository { 
    async findById(productId: number): Promise<Product | null> { 
        // Find product by ID in the database 
        const product = await this.prisma.product.findUnique({ 
            where: { id: productId }
        }); 
        
        return product ? new Product(product) : null; 
    } 
} 

// Avoid: Non-English comments or names 
export class RepositorioProducto { 
    async buscarPorId(idProducto: number): Promise<Producto | null> { 
        // Buscar producto por ID en la base de datos 
        const producto = await this.prisma.product.findUnique({ 
            where: { id: idProducto } 
        }); 
        
        return producto ? new Producto(producto) : null; 
    } 
}
```

**Error Messages and Logs:**

```typescript
// Good: English error messages 
throw new NotFoundError('Product not found with the provided ID'); 
logger.error('Failed to create product', { error: error.message }); 

// Avoid: Non-English messages 
throw new NotFoundError('Producto no encontrado con el ID proporcionado'); 
logger.error('Error al crear producto', { error: error.message });
```

### TypeScript Usage

- **Strict Mode**: Always enable strict mode in `tsconfig.json`
- **Type Definitions**: Use explicit types for function parameters and return values
- **Interfaces**: Define interfaces for complex data structures
- **Avoid `any`**: Use `unknown` or specific types instead of `any` when possible

```typescript
// Good: Explicit types 
async function findProductById(id: number): Promise<Product | null> { 
    // implementation 
    } 
    
    // Avoid: Using any 
    function processData(data: any): any { 
        // implementation 
    }
```

### Error Handling

- **Custom Error Classes**: Create domain-specific error classes
- **Error Middleware**: Use global error middleware for consistent error responses
- **Error Messages**: Provide descriptive error messages for debugging

```typescript
export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}

// In controller
try {
    const product = await productService.findById(id);
    if (!product) {
        throw new NotFoundError('Product not found');
    }
    res.json(product);
} catch (error) {
    next(error);
}

Recommended domain-specific errors:

export class ProductNotFoundError extends Error {}
export class CustomerOrderNotFoundError extends Error {}
export class SupplierOrderNotFoundError extends Error {}
export class InvalidOrderStatusTransitionError extends Error {}
export class SupplierCostExposureError extends Error {}
```

### Validation Patterns

- **Input Validation**: Validate all inputs at the application layer
- **Use Validator Module**: Centralize validation logic in `src/application/validator.ts`
- **Validate Before Processing**: Always validate before executing business logic

```typescript
import { validateProductData } from '../application/validator'; 

export async function addProduct(req: Request, res: Response, next: NextFunction) { 
    try { 
        const validatedData = validateProductData(req.body); 
        const product = await productService.create(validatedData); 
        res.status(201).json(product); 
    } catch (error) { 
        next(error); 
    } 
}
```

### Recommended validation examples:

```typescript
import { validateCustomerOrderData } from '../application/validator';

export async function addCustomerOrder(req: Request, res: Response, next: NextFunction) {
    try {
        const validatedData = validateCustomerOrderData(req.body);
        const customerOrder = await customerOrderService.create(validatedData);
        res.status(201).json(customerOrder);
    } catch (error) {
        next(error);
    }
}
```

### Logging Standards

- **Use Logger Class**: Use the centralized logger from `src/infrastructure/logger.ts`
- **Log Levels**: Use appropriate log levels (info, error, warn, debug)
- **Structured Logging**: Include relevant context in log messages

```typescript
import { Logger } from '../infrastructure/logger'; 

const logger = new Logger(); 

logger.info('Product created', { productId: product.id }); 
logger.error('Failed to create product', { error: error.message }); 
logger.info('Customer order created', { customerOrderId: customerOrder.id }); 
logger.info('Supplier order requested', { supplierOrderId: supplierOrder.id });
```

## API Design Standards

### REST Endpoints

- **RESTful Naming**: Use RESTful conventions for endpoint naming
- **HTTP Methods**: Use appropriate HTTP methods (GET, POST, PUT, DELETE, PATCH)
- **Resource-Based URLs**: URLs should represent resources, not actions

```typescript
GET /products // List products 
GET /products/:id // Get product by ID 
POST /products // Create new product 
PUT /products/:id // Update product 
DELETE /products/:id // Delete product 

GET /customer-orders // List customer orders 
GET /customer-orders/:id // Get customer order by ID 
POST /customer-orders // Create new customer order 
PUT /customer-orders/:id // Update customer order 

GET /suppliers // List suppliers 
GET /suppliers/:id // Get supplier by ID 
POST /suppliers // Create supplier 
PUT /suppliers/:id // Update supplier 

GET /supplier-orders // List supplier orders 
GET /supplier-orders/:id // Get supplier order by ID 
POST /supplier-orders // Create supplier order 
PUT /supplier-orders/:id // Update supplier order
```

### Request/Response Patterns

- **JSON Format**: Use JSON for request and response bodies
- **Consistent Structure**: Maintain consistent response structure across all endpoints
- **Status Codes**: Use appropriate HTTP status codes

```typescript
// Success response
{
    "success": true,
    "data": { ... },
    "message": "Operation completed successfully"
}

// Error response
{
    "success": false,
    "error": {
        "message": "Error description",
        "code": "ERROR_CODE"
    }
}
```

### Error Response Format

- **Consistent Format**: All errors should follow the same response structure
- **Error Codes**: Use meaningful error codes for different error types
- **HTTP Status Codes**: Map errors to appropriate HTTP status codes

```typescript
// 400 Bad Request
{
    "success": false,
    "error": {
        "message": "Validation failed",
        "code": "VALIDATION_ERROR",
        "details": [ ... ]
    }
}

// 404 Not Found
{
    "success": false,
    "error": {
        "message": "Resource not found",
        "code": "NOT_FOUND"
    }
}
```

### Recommended ecommerce error codes:

```typescript
VALIDATION_ERROR
PRODUCT_NOT_FOUND
CUSTOMER_ORDER_NOT_FOUND
SUPPLIER_ORDER_NOT_FOUND
INVALID_ORDER_STATUS_TRANSITION
SUPPLIER_OUT_OF_STOCK
SUPPLIER_COST_EXPOSURE_BLOCKED
```

### CORS Configuration

- **Enable CORS**: Configure CORS to allow frontend origin(s) listed in `FRONTEND_URL` (comma-separated).
- **Development**: When `NODE_ENV=development`, allow all origins so CRA dev-server proxy requests succeed during local E2E.
- **Production**: Restrict to explicit origins only; never use wildcard with credentials.
- **Credentials**: Configure credentials handling appropriately.

```typescript
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3001,http://localhost:3002')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const isDev = process.env.NODE_ENV === 'development';

app.use(cors({
  origin: (origin, callback) => {
    if (isDev) return callback(null, true);
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
```

## Database Patterns

### Prisma Schema

- **Single Source of Truth**: `prisma/schema.prisma` is the single source of truth for database structure
- **Relationships**: Define relationships using Prisma relations
- **Naming Conventions**: Use consistent naming conventions (camelCase for fields, PascalCase for models)

### Main Prisma models may include:

```typescript
Product
ProductVariant
Category
Customer
CustomerOrder
CustomerOrderItem
Supplier
SupplierOrder
SupplierOrderItem
Shipment
ReturnRequest
Refund
```

### Migrations

- **Version Control**: All database changes must be version-controlled through migrations
- **Migration Naming**: Use descriptive names for migrations
- **Review Migrations**: Review migration files before applying

```bash
# Create migration
npx prisma migrate dev --name descriptive_migration_name

# Apply migrations in production
npx prisma migrate deploy
```

### Recommended ecommerce migration names:

```bash
npx prisma migrate dev --name create_product_catalog
npx prisma migrate dev --name create_customer_orders
npx prisma migrate dev --name create_supplier_orders
npx prisma migrate dev --name create_shipments
```

### Repository Pattern

- **Repository Interfaces**: Define repository interfaces in the domain layer
- **Prisma Implementation**: Implement repositories using Prisma in the infrastructure layer
- **Dependency Injection**: Inject Prisma client into repositories

```typescript
// Domain layer interface
export interface IProductRepository {
    findById(id: number): Promise<Product | null>;
    save(product: Product): Promise<Product>;
}

// Infrastructure layer implementation
export class ProductRepository implements IProductRepository {
    constructor(private prisma: PrismaClient) {}

    async findById(id: number): Promise<Product | null> {
        const data = await this.prisma.product.findUnique({ where: { id } });
        return data ? new Product(data) : null;
    }
}

Additional ecommerce repositories:

export interface ICustomerOrderRepository {
    findById(id: number): Promise<CustomerOrder | null>;
    save(customerOrder: CustomerOrder): Promise<CustomerOrder>;
}

export interface ISupplierOrderRepository {
    findById(id: number): Promise<SupplierOrder | null>;
    save(supplierOrder: SupplierOrder): Promise<SupplierOrder>;
    findByCustomerOrderId(customerOrderId: number): Promise<SupplierOrder[]>;
}
```

## Testing Standards

The project has strict requirements for code quality and maintainability. These are the unit testing standards and best practices that must be applied. 

### Test File Structure
- Use descriptive test file names: `[componentName].test.ts`
- Place test files alongside the source code they test
- Use Jest as the testing framework with TypeScript support
- Maintain 90% coverage threshold for branches, functions, lines, and statements


### Test Organization Pattern
Template:
```typescript
describe('[ComponentName] - [methodName]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('should_[expected_behavior]_when_[condition]', () => {
    it('should [specific test case]', async () => {
      // Arrange
      // Act  
      // Assert
    });
  });
});
```

Real example:
```typescript
describe('ProductService - findById', () => { 
    beforeEach(() => { 
        jest.clearAllMocks(); 
    }); 
    
    it('should return product when found', async () => { 

        // Arrange 
        const productId = 1; const mockProduct = new Product({ 
            id: 1, name: 'Black midi dress'}); 
        (ProductRepository.findById as jest.Mock).mockResolvedValue(mockProduct); 
        
        // Act 
        const result = await productService.findById(productId); 

        // Assert 
        expect(result).toEqual(mockProduct); 
        expect(ProductRepository.findById).toHaveBeenCalledWith(productId); 
    }); 
});
```



### Test Case Naming Convention
- Use descriptive, behavior-driven naming: `should_[expected_behavior]_when_[condition]`
- Group related test cases under descriptive `describe` blocks
- Use snake_case for describe blocks and camelCase for individual tests

### Test Structure (AAA Pattern)
Always follow the Arrange-Act-Assert pattern:
```typescript
it('should create supplier order successfully when customer order is paid', async () => {
  // Arrange - Set up test data and mocks
  const customerOrderId = 1;
  const supplierId = 1;

  // Act - Execute the function under test
  const result = await createSupplierOrder(customerOrderId, supplierId);

  // Assert - Verify the expected behavior
  expect(result).toEqual(expectedResult);
});
```

Assertion pattern:
- Use specific matchers: `toHaveBeenCalledWith()`, `toHaveBeenCalledTimes()`
- Verify both successful operations and error conditions
- Check that mocks were called with correct parameters
- Assert on return values and side effects

### Mocking Standards

- Mock all external dependencies (models, services, database clients)
- Mock repository layers in service tests
- Mock service layers in controller tests
- Use `jest.mock()` at the top of test files for module-level mocking
- Create mock instances with realistic data structures
- Clear all mocks in `beforeEach()` to ensure test isolation


### Test Coverage Requirements

- **Comprehensive test coverage**: Include these test categories for each function:
1. **Happy Path Tests**: Valid inputs producing expected outputs
2. **Error Handling Tests**: Invalid inputs, missing data, database errors
3. **Edge Cases**: Boundary values, null/undefined inputs, empty data
4. **Validation Tests**: Input validation, business rule enforcement
5. **Integration Points**: External service calls, database operations

- **Threshold**: 90% for branches, functions, lines, and statements
- **Coverage Reports**: Generate coverage reports with `npm run test:coverage`
- **Coverage Files**: Coverage reports in `coverage/` directory adding the date, like YYYYMMDD-backend-coverage.md


### Error Testing
- Test both expected errors and unexpected errors
- Verify error messages are descriptive and helpful
- Test error propagation through service layers
- Ensure proper HTTP status codes in controller tests

### Controller Testing Specifics
- Mock the service layer completely
- Test HTTP request/response handling
- Verify parameter parsing and validation
- Test error response formatting
- Use realistic Express Request/Response mocks

### Service Testing Specifics
- Mock domain models and repositories
- Test business logic in isolation
- Verify data transformation and validation
- Test error handling and edge cases
- Mock external dependencies (Prisma, validators)

### Recommended ecommerce service tests:

- shouldCreateProductWhenValidDataProvided()
- shouldRejectProductWhenPublicPriceIsInvalid()
- shouldCreateCustomerOrderWhenItemsAreValid()
- shouldCreateSupplierOrderWhenCustomerOrderIsPaid()
- shouldRejectSupplierOrderWhenCustomerOrderIsCancelled()
- shouldBlockSupplierCostInCustomerFacingResponses()

### Database Testing
- Mock Prisma client and all database operations
- Test both successful and failed database operations
- Verify correct database queries and parameters
- Test transaction handling and rollback scenarios

### Async Testing
- Always use `async/await` for asynchronous operations
- Use `Promise.allSettled()` for testing concurrent operations

### ESLint / CI requirements (MANDATORY before PR)

CI job **`backend-quality`** runs `npm run lint` (`eslint src --ext .ts`). All new and touched files must pass.

| Rule | Practice |
|------|----------|
| `@typescript-eslint/no-unused-vars` | Prefix intentionally unused params with `_` |
| `@typescript-eslint/no-explicit-any` | Avoid `any`; use proper types or `unknown` |
| General | Match import style and patterns in neighbouring test files |

Run locally after implementing tests:

```bash
cd backend
npm run lint
npm test -- --watchAll=false --testPathPattern=<feature>
```
- Properly handle promise rejections in tests
- Test timeout scenarios where applicable

### Test Data Management
- Use factory functions for creating test data
- Keep test data consistent and realistic
- Avoid hardcoded values in multiple places
- Use meaningful test data that reflects real-world scenarios

### Recommended test builders:

- ProductTestBuilder
- ProductVariantTestBuilder
- CustomerOrderTestBuilder
- SupplierOrderTestBuilder
- ShipmentTestBuilder

### Integration Testing

- **Controller Testing**: Test HTTP request/response handling
- **Database Testing**: Test repository implementations with database
- **End-to-End Flow**: Test complete request flows

### Recommended ecommerce integration flows:

- create product -> create product variant -> list products
- create customer order -> create supplier order -> update fulfillment status
- create supplier order -> register shipment -> mark as shipped

### Code Quality Standards

#### TypeScript Usage
- Use strict typing for all test parameters and return values
- Define proper interfaces for mock data
- Use type assertions sparingly and with proper justification
- Leverage TypeScript's type system for better test reliability

#### Documentation
- Write clear, descriptive test names that explain the scenario
- Add comments for complex test setups
- Document any special test conditions or edge cases
- Keep test code as readable as production code

#### Performance Considerations
- Keep tests fast and focused
- Avoid unnecessary async operations in tests
- Use appropriate mock strategies to avoid real I/O
- Group related tests to minimize setup/teardown overhead

### Integration with Development Workflow
- Run tests before every commit
- Ensure all tests pass before merging
- Use test-driven development when appropriate
- Update tests when modifying existing functionality

### Common Anti-Patterns to Avoid
- Don't test implementation details, test behavior
- Don't create overly complex test setups
- Don't ignore failing tests or skip error scenarios
- Don't use real database connections in unit tests
- Don't create tests that depend on external services
- Don't write tests that are too tightly coupled to implementation

### Example Test Structure



## Performance Best Practices

### Database Query Optimization

- **Select Specific Fields**: Only select fields that are needed
- **Use Indexes**: Ensure proper database indexes for frequently queried fields
- **Avoid N+1 Queries**: Use Prisma's `include` to fetch related data efficiently

```typescript
// Good: Fetch related data efficiently
const product = await prisma.product.findUnique({
    where: { id },
    include: {
        variants: true,
        category: true
    }
});

// Avoid: N+1 queries
const product = await prisma.product.findUnique({ where: { id } });
const variants = await prisma.productVariant.findMany({ where: { productId: id } });

Additional example:

// Good: Fetch customer order data efficiently
const customerOrder = await prisma.customerOrder.findUnique({
    where: { id },
    include: {
        items: true,
        supplierOrders: true
    }
});
```

### Async/Await Patterns

- **Always Use Async/Await**: Use async/await instead of promises chains
- **Error Handling**: Properly handle errors in async operations
- **Parallel Operations**: Use `Promise.all()` for parallel operations when appropriate

```typescript
// Good: Parallel operations 
const [products, suppliers] = await Promise.all([ 
    productService.findAll(), 
    supplierService.findAll() 
]);
```

### Error Handling Performance

- **Early Returns**: Return early to avoid unnecessary processing
- **Error Propagation**: Let errors propagate naturally through the call stack
- **Avoid Over-Wrapping**: Don't wrap errors unnecessarily

## Security Best Practices

### Input Validation

- **Validate All Inputs**: Validate all user inputs before processing
- **Sanitize Data**: Sanitize data to prevent injection attacks
- **Type Checking**: Use TypeScript and validation to ensure type safety
- **Protect Supplier Data**: Supplier costs, supplier credentials, and internal fulfillment notes must never be exposed through customer-facing APIs

### Environment Variables

- **Never Commit Secrets**: Never commit `.env` files or secrets to version control
- **Use Environment Variables**: Use environment variables for configuration
- **Validate Environment**: Validate required environment variables at startup

```typescript
// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'PORT'];
requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        throw new Error(`Missing required environment variable: ${varName}`);
    }
});
```

### Additional ecommerce environment variables may include:

```typescript
const ecommerceEnvVars = [
    'PAYMENT_PROVIDER_SECRET',
    'ADMIN_FRONTEND_URL',
    'CUSTOMER_FRONTEND_URL'
];
```

### Dependency Injection

- **Inject Prisma Client**: Inject Prisma client via Express middleware
- **Avoid Global State**: Avoid global state for database connections
- **Testability**: Use dependency injection to improve testability

```typescript
// Middleware to inject Prisma client
app.use((req: Request, res: Response, next: NextFunction) => {
    req.prisma = prisma;
    next();
});

// Use in controllers 
export async function getProduct(req: Request, res: Response) { 
    const product = await req.prisma.product.findUnique({ 
        where: { id: req.params.id } 
    }); 
    res.json(product); 
}
```

## Development Workflow

### Git Workflow

- **Feature Branches**: Develop features in separate branches using clear descriptive names to allow working in parallel and avoid conflicts or collisions
- **Descriptive Commits**: Write descriptive commit messages in English
- **Code Review**: Code review before merging
- **Small Branches**: Keep branches small and focused

### Recommended branch names:

- feature/product-catalog
- feature/customer-orders
- feature/supplier-management
- feature/supplier-orders
- feature/shipment-tracking

### Development Scripts

```bash
npm run dev          # Development server with hot reload
npm run build        # Build for production
npm test             # Run tests
npm run test:coverage # Run tests with coverage
npm run prisma:generate  # Generate Prisma client
npx prisma migrate dev   # Create and apply migration
npx prisma db seed       # Seed database
```

### Code Quality

- **ESLint Validation**: Run ESLint before commits
- **TypeScript Compilation**: Ensure TypeScript compiles without errors
- **All Tests Passing**: Ensure all tests pass before deployment
- **Code Review**: Review code for adherence to standards

## Environments

The backend supports two deployment environments with distinct configurations. The production deployment model must NOT be changed without explicit approval.

### Development (Local Docker)

- **Runtime**: `ts-node-dev` inside a Docker container (hot-reload via `backend/src` bind-mount)
- **Database**: Postgres 15 in the `db` Docker Compose service — `DATABASE_URL` points to `db:5432`
- **SMTP**: Mailpit in the `mailpit` Compose service — `SMTP_HOST=mailpit`
- **Config file**: `backend/.env.docker` (git-ignored; never commit)
- **Startup**: `docker compose up -d` from project root — starts db, mailpit, backend and frontend; migrations and seed run automatically via `entrypoint.sh`
- **Prisma binary targets**: `schema.prisma` includes `linux-musl-openssl-3.0.x` for Alpine Linux compatibility

### Production (AWS Lambda)

- **Runtime**: AWS Lambda `nodejs20.x` via Serverless Framework
- **Database**: AWS RDS PostgreSQL in `eu-north-1` — connection string in SSM Parameter Store
- **SMTP**: External SMTP provider configured via SSM
- **Config**: All secrets via SSM Parameter Store at `/ecommerce/prod/*`; no `.env` file on Lambda
- **Deployment**: `cd backend && npx serverless deploy --stage prod`

### trust proxy Convention

Express must be configured with `trust proxy` before any middleware is mounted:

```ts
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : 'loopback');
```

- **`production`**: trusts exactly 1 hop (API Gateway + CloudFront each add one `X-Forwarded-For`; only the outermost hop is trusted)
- **`development`**: trusts loopback only (the CRA dev proxy runs on `127.0.0.1`)

This prevents `express-rate-limit` v8 from throwing `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` in both environments while preserving accurate per-IP rate limiting. Setting `trust proxy: true` globally is prohibited — it allows IP spoofing to bypass rate limits.

## Serverless Deployment

### AWS Lambda Configuration

- **Lambda Handler**: Entry point is `src/lambda.ts`
- **Serverless HTTP**: Use `serverless-http` to wrap Express app
- **Environment Variables**: Configure environment variables in `serverless.yml`

### Serverless Framework

- **Configuration File**: `serverless.yml` defines Lambda configuration (`nodejs20.x` runtime)
- **Build Command**: Use `npm run build` (`tsc` → `dist/`) before deploy; handler entry is `dist/lambda.handler`
- **Deployment**: Deploy using `npm run deploy:lambda` or `npx serverless deploy` from `backend/`
- **Secrets**: Production secrets are injected via SSM Parameter Store references in `serverless.yml` (`/ecommerce/prod/*`)

## Authentication (Admin vs Customer)

The API uses **dual JWT namespaces**:

| Audience | Secret env | Cookie | Middleware |
|----------|------------|--------|------------|
| Admin | `ADMIN_JWT_SECRET` | `admin_refresh` | `requireAdminAuth` |
| Customer | `CUSTOMER_JWT_SECRET` | `customer_refresh` | `requireCustomerAuth` |

- All `/api/admin/*` routes except `POST /api/admin/auth/login` and `POST /api/admin/auth/refresh` require a Bearer token with `aud: "admin"`.
- Customer account routes under `/api/public/account/*` and authenticated checkout require `aud: "customer"`.
- Tokens with the wrong audience are rejected with `401`.
- `passwordHash`, refresh token values, and `totpSecret` must never appear in API responses or logs.
- Seed admin via `npx ts-node prisma/seedAdmin.ts` using `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

```typescript
// middleware/requireAdminAuth.ts — rejects missing or non-admin tokens
// middleware/requireCustomerAuth.ts — rejects missing or non-customer tokens
```

```typescript
// lambda.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import serverless from 'serverless-http';
import { app } from './index';

const serverlessHandler = serverless(app);

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  context.callbackWaitsForEmptyEventLoop = false;
  return await serverlessHandler(event, context) as APIGatewayProxyResult;
};
```

## Stripe Payment Integration Standards

### Stripe Client Singleton

The Stripe client lives at `backend/src/infrastructure/stripe/stripeClient.ts` and is a module-level singleton:

```typescript
import Stripe from 'stripe';
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2026-05-27.dahlia',
});
```

The `sk_test_placeholder` fallback allows Jest to import this module without a real key. Tests that exercise Stripe must mock this module with `jest.mock('../../../infrastructure/stripe/stripeClient', ...)`.

### Secret Key Protection (CRITICAL)

- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` **MUST NEVER** appear in any API response, log line, or be exposed to clients
- Only `STRIPE_PUBLISHABLE_KEY` may be returned via `GET /api/public/payments/config`
- `stripePaymentIntentId` and `stripeChargeId` on `CustomerOrder` are **INTERNAL ONLY** — exclude them from all public API serializers

### Webhook raw-body Middleware Ordering (CRITICAL)

Stripe webhook signature verification requires the raw request body as a `Buffer`. In `index.ts`, `express.raw()` **must be registered before** `express.json()` on the webhook path:

```typescript
// MUST come before express.json()
app.use('/api/public/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
```

Reversing this order breaks `stripe.webhooks.constructEvent` signature verification.

### Webhook Idempotency

All processed Stripe events are logged in `StripeWebhookEvent` by `stripeEventId`. Before processing, check for an existing record — duplicate events are silently ignored. This prevents double-payment on Stripe retries.

### Amount Conversion

Always use the `toStripeAmount(amount: Decimal, currency: string): number` helper (`backend/src/infrastructure/stripe/toStripeAmount.ts`) to convert `Decimal` amounts to Stripe's integer minor-unit format:

```typescript
// 29.99 EUR → 2999
Math.round(amount.times(100).toNumber())
```

Never perform inline conversion — rounding errors from floating-point arithmetic corrupt charge amounts.

### Idempotency Keys

Always pass idempotency keys to Stripe calls to prevent duplicate charges on retries:

| Operation | Key format |
|-----------|-----------|
| `paymentIntents.create` | `order:{orderNumber}:pi` |
| `refunds.create` | `refund:{refundId}` |

### Stripe SDK Version

The installed SDK version may differ from what is documented in the plan. Always use the installed SDK's `API_VERSION` constant:

```bash
node -e "const Stripe = require('stripe'); console.log(Stripe.API_VERSION)"
```

### Environment Variables

Required in non-test environments (validated at startup in `index.ts`):

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Server-side API key — never expose to clients |
| `STRIPE_PUBLISHABLE_KEY` | Browser-safe key returned by `/api/public/payments/config` |
| `STRIPE_WEBHOOK_SECRET` | Used by `stripe.webhooks.constructEvent` for signature verification |
| `STRIPE_MODE` | `test` or `live` — returned alongside publishable key for client-side Stripe.js initialization |

---

This document serves as the foundation for maintaining code quality and consistency across the women's fashion ecommerce backend application. All team members should follow these practices to ensure a maintainable, scalable, and testable codebase.
