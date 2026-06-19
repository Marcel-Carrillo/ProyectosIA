# Development Guide

This guide provides step-by-step instructions for setting up the development environment and running tests for the women's fashion ecommerce system.

The project uses a React frontend, a Node.js/TypeScript/Express backend, Prisma, PostgreSQL, Docker, and Cypress for end-to-end testing.

## 🚀 Setup Instructions

### Prerequisites

Ensure you have the following installed:

* **Node.js** (v20.0.0 or higher — aligns with AWS Lambda `nodejs20.x` runtime)
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

Copy `backend/.env.example` to `backend/.env` and adjust values for your local environment:

```env
DATABASE_URL="postgresql://ecommerceUser:ecommercePassword@localhost:5432/ecommerceDb"
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
API_PUBLIC_URL=http://localhost:3000
```

OAuth redirect URIs must point at the **backend** callback routes (not the React app):

| Provider | Callback URL (local) |
|----------|----------------------|
| Google | `http://localhost:3000/api/public/auth/google/callback` |
| Facebook | `http://localhost:3000/api/public/auth/facebook/callback` |
| Apple | `http://localhost:3000/api/public/auth/apple/callback` |

Add provider secrets to `backend/.env` when available:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
```

Until credentials are set, social login buttons stay hidden on the storefront (`GET /api/public/auth/oauth/providers`). Non-production builds can still use `POST /api/public/auth/oauth/mock` for manual OAuth testing.

**Stripe Payment Variables** (`backend/.env`):

| Variable | Description | Mode |
|----------|-------------|------|
| `STRIPE_MODE` | `test` or `live` | Both |
| `STRIPE_SECRET_KEY` | Server-side API key — **never expose to clients** | Both |
| `STRIPE_PUBLISHABLE_KEY` | Browser-safe key — returned by `/api/public/payments/config` | Both |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `stripe.webhooks.constructEvent` | Both |

**Test mode** (no charges):
```env
STRIPE_MODE=test
STRIPE_SECRET_KEY=sk_test_...    # from Stripe Dashboard → Developers → API keys
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # from `stripe listen` output (see below)
```

**Local webhook forwarding** with the Stripe CLI:
```bash
# Install: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to http://localhost:3000/api/public/payments/webhook
# Copy the whsec_... value shown and set it as STRIPE_WEBHOOK_SECRET
```

**Stripe test cards**:

| Card number | Behavior |
|-------------|----------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 9995` | Declined |
| `4000 0025 0000 3155` | 3DS required |

**Frontend Environment** (`frontend/.env.development`):

```env
REACT_APP_API_BASE_URL=http://localhost:3000
PORT=3001
```

> See `frontend/.env.example` for the full list of supported variables. Do not commit `.env.development` — it is listed in `.gitignore`.

### 3. Database Setup (PostgreSQL with Docker)

Start the PostgreSQL database and Mailpit (local SMTP + inbox UI) using Docker Compose:

```bash
# Start PostgreSQL and Mailpit
docker compose up -d

# Verify containers are running
docker compose ps
```

The PostgreSQL database will be available at:

* **Host**: `localhost`
* **Port**: `5432`
* **Database**: `ecommerceDb`
* **Username**: `ecommerceUser`
* **Password**: `ecommercePassword`

**Mailpit** (password reset emails in local dev):

* **SMTP**: `localhost:1025` (configure `SMTP_HOST` / `SMTP_PORT` in `backend/.env`)
* **Web UI**: [http://localhost:8025](http://localhost:8025) — inspect reset links after `POST /api/public/auth/forgot-password`

Integration test `passwordResetEmail.test.ts` exercises this flow when Mailpit is running.

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
Backend health:  http://localhost:3000/health  → 200 {"status":"ok","db":"up"}
Backend API:     http://localhost:3000
Frontend app:    http://localhost:3001
PostgreSQL:      localhost:5432
```

When the database is unreachable, `GET /health` returns HTTP 503 with `{"status":"error","db":"down"}`.

Run the post-deploy smoke script against a running API:

```bash
bash scripts/smoke.sh http://localhost:3000
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

## 🚀 Production Deployment (AWS Serverless)

This section documents the MVP production pipeline: backend on AWS Lambda (Serverless Framework), frontend on S3 + CloudFront, secrets in SSM Parameter Store, and CI deploy via GitHub Actions.

### Prerequisites

- **AWS CLI** configured with credentials for the deploy IAM user
- **Node.js 20** (matches Lambda `nodejs20.x` runtime and CI)
- **Serverless Framework**: `npm i -g serverless` (or use `npx serverless` from `backend/`)
- **GitHub CLI** (`gh`) for PR workflow (optional locally)
- **PostgreSQL** production database (RDS or equivalent)

**Prerequisite gate:** KAN-23 (admin authentication) must be verified Done before exposing the admin API surface in production.

### One-time AWS setup

1. **SSM Parameter Store** — create SecureString parameters under `/ecommerce/prod/`:

   | Parameter | Purpose |
   |-----------|---------|
   | `DATABASE_URL` | PostgreSQL connection string (append `?connection_limit=1` for Lambda) |
   | `ADMIN_JWT_SECRET` | Admin JWT signing secret |
   | `CUSTOMER_JWT_SECRET` | Customer JWT signing secret |
   | `COOKIE_SECRET` | Cookie-parser secret (min 32 chars) |
   | `ADMIN_JWT_EXPIRES_IN` | Admin access token TTL |
   | `CUSTOMER_JWT_EXPIRES_IN` | Customer access token TTL |
   | `SMTP_HOST` | SMTP server host |
   | `SMTP_PORT` | SMTP port |
   | `SMTP_SECURE` | `true` or `false` |
   | `SMTP_USER` | SMTP username |
   | `SMTP_PASS` | SMTP password |
   | `SMTP_FROM` | From address for transactional email |
   | `FRONTEND_URL` | Public storefront URL (CORS / redirects) |

2. **S3 bucket** — create a bucket for the CRA `frontend/build/` artifacts (manual, one-time).

3. **CloudFront distribution** — point origin at the S3 bucket (manual, one-time).

4. **IAM user** — least-privilege policy for CI: Lambda deploy, SSM read, S3 sync, CloudFront invalidation.

5. **CloudWatch alarm** (manual, one-time) — alarm name `ecommerce-api-5xx-high`:
   - Metric: `AWS/ApiGateway` → `5XXError`
   - Threshold: ≥ 5 errors in a 5-minute period
   - Action: SNS notification (configure as needed)

### GitHub Actions secrets

Configure these repository secrets for `.github/workflows/deploy.yml`:

| Secret | Purpose |
|--------|---------|
| `PROD_DATABASE_URL` | `prisma migrate deploy` in CI |
| `AWS_ACCESS_KEY_ID` | AWS deploy credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS deploy credentials |
| `PROD_API_BASE_URL` | Post-deploy smoke test base URL |
| `REACT_APP_API_BASE_URL` | Baked into frontend production build |
| `PROD_S3_BUCKET` | S3 bucket name for frontend sync |
| `PROD_CF_DIST_ID` | CloudFront distribution ID for cache invalidation |

### Deploy sequence (manual or CI)

The `deploy` workflow on push to `master` runs the same steps:

```bash
# Backend
cd backend
npm ci
npm run build
npx prisma generate
DATABASE_URL="$PROD_DATABASE_URL" npx prisma migrate deploy
npx serverless deploy --stage prod

# Frontend
cd ../frontend
npm ci
REACT_APP_API_BASE_URL="$PROD_API_URL" npm run build
aws s3 sync build/ s3://$PROD_S3_BUCKET --delete
aws cloudfront create-invalidation --distribution-id $PROD_CF_DIST_ID --paths "/*"

# Smoke test
bash scripts/smoke.sh "$PROD_API_BASE_URL"
```

### Smoke tests

`scripts/smoke.sh` accepts an optional base URL (default `http://localhost:4000`). For local dev use port **3000**:

```bash
bash scripts/smoke.sh http://localhost:3000
```

Assertions: `GET /health` → 200 with `"status"` in body; `GET /api/public/products` → 200; `GET /api/admin/products` (no token) → 401.

### Rollback

- **Backend:** `cd backend && npx serverless rollback --stage prod`
- **Frontend:** Re-sync a previous `frontend/build/` artifact to S3 and invalidate CloudFront

### Lambda database connections

Append `?connection_limit=1` to `DATABASE_URL` in SSM for Lambda to avoid exhausting PostgreSQL connection limits.
