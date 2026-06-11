# Development Guide

This guide provides step-by-step instructions for setting up the development environment and running tests for the women's fashion ecommerce system.

The project uses a React frontend, a Node.js/TypeScript/Express backend, Prisma, PostgreSQL, Docker, and Cypress for end-to-end testing.

## 🚀 Setup Instructions

### Prerequisites

Ensure you have the following installed:

* **Node.js** (v16 or higher)
* **npm** (v8 or higher)
* **Docker** and **Docker Compose**
* **Git**

### 1. Clone the Repository

```bash
git clone git@github.com:your-organization/your-ecommerce-repository.git
cd your-ecommerce-repository
```

### 2. Environment Configuration

Create environment files for both backend and frontend.

**Backend Environment** (`backend/.env`):

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=ecommerceUser
DB_PASSWORD=ecommercePassword
DB_NAME=ecommerceDb

# Application Configuration
PORT=3000
NODE_ENV=development

# Prisma Database URL
DATABASE_URL="postgresql://ecommerceUser:ecommercePassword@localhost:5432/ecommerceDb"
```

**Frontend Environment** (`frontend/.env`):

```env
REACT_APP_API_URL=http://localhost:3000
```

### 3. Database Setup (PostgreSQL with Docker)

Start the PostgreSQL database using Docker Compose:

```bash
# Start PostgreSQL container
docker-compose up -d

# Verify the database is running
docker-compose ps
```

The PostgreSQL database will be available at:

* **Host**: `localhost`
* **Port**: `5432`
* **Database**: `ecommerceDb`
* **Username**: `ecommerceUser`
* **Password**: `ecommercePassword`

### 4. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npx prisma migrate deploy

# Optional: seed the database with sample data
npx prisma db seed

# Start the development server
npm run dev
```

The backend API will be available at:

```text
http://localhost:3000
```

### 5. Frontend Setup

```bash
# Navigate to frontend directory from project root
cd frontend

# Install dependencies
npm install

# Start the development server
npm start
```

The frontend application will be available at:

```text
http://localhost:3001
```

### 6. Cypress Testing Suite Setup

```bash
# From the frontend directory
cd frontend

# Install dependencies if not already installed
npm install

# Open Cypress Test Runner in interactive mode
npm run cypress:open

# Run Cypress tests headlessly
npm run cypress:run
```

## 🧪 Testing

### Backend Testing

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Frontend Testing

```bash
cd frontend

# Run unit tests
npm test

# Run E2E tests with Cypress
npm run cypress:run

# Open Cypress Test Runner
npm run cypress:open
```

## 🗄️ Prisma Commands

Use the following commands when working with Prisma and PostgreSQL.

```bash
cd backend

# Generate Prisma client
npm run prisma:generate

# Create and apply a new development migration
npx prisma migrate dev --name migration_name

# Apply existing migrations
npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio

# Seed the database
npx prisma db seed
```

Recommended migration names for this project:

```bash
npx prisma migrate dev --name create_product_catalog
npx prisma migrate dev --name create_suppliers
npx prisma migrate dev --name create_customer_orders
npx prisma migrate dev --name create_supplier_orders
npx prisma migrate dev --name create_shipments_returns_refunds
```

## 📦 Main Development Areas

The main backend and frontend development areas are:

* Product catalog
* Product variants
* Categories
* Suppliers
* Customers
* Customer orders
* Supplier orders
* Shipments
* Return requests
* Refunds

## 🧭 Business Context

The initial business model is supplier-fulfilled ecommerce:

* The store does not manage its own warehouse at the beginning.
* Customers place orders through the online store.
* Store administrators process supplier orders in the background.
* Suppliers may ship products directly to customers.
* The system must support future evolution to internal stock, hybrid fulfillment, multiple suppliers, and supplier automation.

## 🔐 Security Notes

Never commit real credentials, passwords, tokens, API keys, or `.env` files to version control.

Use placeholder values in documentation and local-only values in `.env` files.

Sensitive supplier information must not be exposed through customer-facing APIs, including:

* Supplier costs
* Supplier references
* Supplier credentials
* Internal supplier notes
* Internal fulfillment notes

## 🧾 Documentation Update Rules

When the codebase changes, review and update the relevant documentation:

* For data model changes, update `docs/data-model.md`.
* For API changes, update `docs/api-spec.yml`.
* For backend architecture, scripts, dependencies, Prisma, or deployment changes, update `docs/backend-standards.md` or this development guide.
* For frontend architecture, components, routes, services, or UI patterns, update `docs/frontend-standards.md`.
* For documentation or AI rule changes, update `docs/documentation-standards.md`.

## ✅ Recommended Startup Order

When starting the project locally, use this order:

```bash
# 1. Start database
docker-compose up -d

# 2. Start backend
cd backend
npm run dev

# 3. Start frontend in a separate terminal
cd frontend
npm start
```

## ✅ Basic Health Checks

After starting the project, verify:

```text
Backend API: http://localhost:3000
Frontend app: http://localhost:3001
PostgreSQL: localhost:5432
```

If the backend cannot connect to the database, verify:

* Docker is running.
* PostgreSQL container is running.
* `DATABASE_URL` matches the Docker Compose database configuration.
* Prisma migrations have been applied.
* The backend `.env` file exists and is placed inside the `backend/` directory.

## 🧪 Suggested Manual Test Flow

After setup, validate the basic ecommerce flow:

1. Create a category.
2. Create a supplier.
3. Create a product.
4. Add one or more product variants.
5. Create a customer.
6. Create a customer order.
7. Create a supplier order from the customer order.
8. Update supplier order status.
9. Register shipment information.
10. Verify customer order fulfillment status.
