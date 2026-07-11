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

**CJ Dropshipping Integration Variables** (`backend/.env`):

| Variable | Description | Required |
|----------|-------------|----------|
| `CJDROPSHIPPING_API_KEY` | CJ Dropshipping API key — **never exposed to clients or logs** | No — falls back to a safe placeholder so the app runs without it |
| `CJ_API_BASE_URL` | CJ Dropshipping API base URL | No — defaults to `https://developers.cjdropshipping.com/api2.0/v1` |
| `CJ_SANDBOX_ORDERS` | When `true` (default), every supplier-order push forces `isSandbox: 1` on CJ order creation | No — defaults to `true` |
| `CJ_SYNC_MAX_PAGES` / `CJ_CATALOG_PAGE_SIZE` | Bounds one sync run's *window* (pages processed this run, starting from the persisted cursor — see below), not "pages 1..N from the start". Default to 500/100 in this local `.env` file (unset) — for local curl/manual verification against the live API, set both small (e.g. `1`/`5`) to avoid burning rate-limit quota. **Production sets these to `3`/`100`** (via `serverless.yml`, SSM-backed; ~300 products/run, ~442s estimated — see `openspec/changes/cj-catalog-cursor-and-media/design.md` D2 for the full throughput study) as a hard requirement, not just a rate-limit courtesy: `syncCatalog` makes one `fetchVariants` API call *per product on every page*, so an unbounded window cannot complete within the Lambda's 900s timeout | No |
| `CJ_DEFAULT_MARKUP_MULTIPLIER` | Default markup applied to `CjCatalogItem.supplierCost` when an admin promotes an item without an explicit `publicPrice`. Promotion never publishes at raw cost — if this is unset and no explicit price is given, promotion fails with `CJ_PROMOTION_PRICE_REQUIRED` | No, but required in practice for bulk promotion without per-item prices |
| `CJ_DEFAULT_CATEGORY_ID` | `Category.id` used by the scheduled `supplierAutoProvision` job (see below) when auto-promoting newly synced items with no human available to pick a category. Must reference an **existing** `Category` row | No — but auto-promotion is skipped (logged) for a run if unset/invalid |
| `SUPPLIER_AUTO_PROVISION_ENABLED` | Kill-switch for the scheduled `supplierAutoProvision` job. Must be exactly `'true'` to run; anything else is a no-op | No — defaults to disabled |

```env
CJDROPSHIPPING_API_KEY=cj_test_replace_with_your_cj_dropshipping_api_key
CJ_API_BASE_URL=https://developers.cjdropshipping.com/api2.0/v1
CJ_SANDBOX_ORDERS=true
CJ_DEFAULT_MARKUP_MULTIPLIER=2.5
CJ_DEFAULT_CATEGORY_ID=
SUPPLIER_AUTO_PROVISION_ENABLED=false
```

Without a real key, `POST /api/admin/suppliers/:supplierId/cj/connection/verify` and `POST /api/admin/suppliers/:supplierId/cj/sync` will report the connection as unhealthy/not-ready — this is expected in local dev unless real CJ Dropshipping credentials are configured.

**Promote → activate/deactivate workflow**: once a supplier's catalog is synced, browse it in the admin panel at `/suppliers/:supplierId/cj-catalog`. Select one or more `Synced` items (items sharing the same CJ product id are grouped into a single `Product` on promotion), choose a category, and promote — this creates real `Product`/`ProductVariant` records linked back to the staged `CjCatalogItem`. Promotion also captures the product/variant images already present in the staged item's `rawPayload` (no extra API call) — sets `Product.mainImageUrl` and creates `ProductImage` rows, only on first promotion of a pid group (not when a variant later joins an already-existing product). Use the page's Activate/Deactivate actions to toggle storefront visibility at any time; the link to the original CJ item is never lost, so an item can be reactivated or promoted again (idempotently) later.

**Catalog sync cursor**: `SupplierIntegration.catalogSyncCursorPage`/`catalogSyncTotalPages`/`catalogSyncWrappedAt` track how far a connection's sync has progressed through the supplier's catalog. Each sync run continues from `cursorPage + 1` rather than always restarting at page 1; reaching the end of the catalog wraps the cursor back to 0 (and stamps `catalogSyncWrappedAt`) so previously-synced items eventually get refreshed too. This applies to both the manual admin "Sync catalog" action and the scheduled `supplierAutoProvision` job — the same underlying `syncCatalog` call.

**Backfilling images for already-promoted products**: `backend/scripts/backfillCjProductImages.ts` retroactively populates `Product.mainImageUrl`/`ProductImage` for products that were promoted before image capture existed, using only already-stored `CjCatalogItem.rawPayload` (zero new CJ API calls). Idempotent — safe to re-run. Invoke with:

```bash
cd backend
npx ts-node --transpile-only scripts/backfillCjProductImages.ts
```

**Dev/prod shared CJ account caveat**: CJ Dropshipping uses the same merchant account/API key for both dev and prod (no separation). The ~1 req/s rate limiter in `cjClient.ts` is in-process per Lambda/server invocation, not globally coordinated — running a manual local sync at the same time as the scheduled production job can double real request pressure against CJ and risk 429s. Avoid large manual syncs while the daily production job would be running.

**Scheduled auto-provisioning job** (`backend/src/jobs/supplierAutoProvisionHandler.ts`): runs once every 24 hours in production (AWS EventBridge, `rate(1 day)` — see `backend/serverless.yml`'s `supplierAutoProvision` function) and automates the manual connect → verify → sync → promote flow above end to end for any configured supplier provider (CJ Dropshipping today). It auto-creates the `Supplier`/`SupplierIntegration` the first time it detects a configured API key with none provisioned yet, then re-syncs and auto-promotes on every run. Auto-promoted products are always created **Draft** (never auto-activated) using `CJ_DEFAULT_CATEGORY_ID` and the existing markup-based pricing — an admin still reviews price and clicks Activate manually. It has no HTTP route by design; to run it manually (support/debugging or local testing), invoke `handler()` from `backend/src/jobs/supplierAutoProvisionHandler.ts` directly (e.g. via a one-off `ts-node` script loading `dotenv/config`) with `SUPPLIER_AUTO_PROVISION_ENABLED=true` and a valid `CJ_DEFAULT_CATEGORY_ID` set. One-time setup required before enabling in any environment: create a fallback `Category` (e.g. "Uncategorized") via the existing admin Category management flow and set its id as `CJ_DEFAULT_CATEGORY_ID`.

**Note on the `frontend` Docker service**: unlike `backend` (which bind-mounts `backend/src`), the `frontend` service has no source bind mount — its image is built once from `frontend/src` at `docker compose build` time. After changing frontend code, run `docker compose build frontend && docker compose up -d --force-recreate frontend` to see the change reflected in Docker Compose; a plain `docker compose restart frontend` will not pick it up.

**Frontend Environment** (`frontend/.env.development`):

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_SITE_URL=http://localhost:3001
```

> The dev server port (3001) is configured in `frontend/vite.config.ts` (`server.port`) — Vite does not read a `PORT` variable.

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

## 🐳 Docker Dev Setup (Recommended)

The recommended local setup runs the entire backend stack in Docker containers. This ensures no connection to the production AWS RDS database and provides a fully isolated, reproducible environment.

### First-time setup

1. **Create `backend/.env.docker`** from the example:

   ```bash
   cp backend/.env.example backend/.env.docker
   ```

   Edit `backend/.env.docker` and set the Docker service URLs:

   ```env
   DATABASE_URL="postgresql://ecommerceUser:ecommercePassword@db:5432/ecommerceDb"
   SMTP_HOST=mailpit
   SMTP_PORT=1025
   NODE_ENV=development
   ```

   Add your Stripe test keys and any optional OAuth credentials. The file is git-ignored — never commit it.

2. **Start all services:**

   ```bash
   docker compose up -d
   ```

   On first run, the backend container automatically:
   - Runs `prisma migrate deploy` against the local Postgres
   - Runs `prisma db seed` (skipped on subsequent runs if data exists)
   - Starts `ts-node-dev` with hot-reload

3. **Start the frontend** (included automatically in `docker compose up`):

   The frontend container starts together with the backend. For faster hot-reload on Windows you can instead run it from the host:

   ```bash
   cd frontend && npm start
   ```

   To skip the frontend container and run only the backend stack:

   ```bash
   docker compose up -d db mailpit backend
   ```

### Daily workflow

```bash
# Start everything
docker compose up -d

# View backend logs
docker compose logs -f backend

# Stop everything
docker compose down
```

### Endpoints

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3000 |
| Frontend | http://localhost:3001 |
| Mailpit UI | http://localhost:8025 |
| Postgres | localhost:5432 |

### Troubleshooting

**`ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` (old installs):** This error from `express-rate-limit` is fixed by the `trust proxy` setting in `backend/src/index.ts`. If you see it, ensure you have the latest code and rebuild: `docker compose up -d --build`.

**Prisma binary target errors:** The `schema.prisma` includes `linux-musl-openssl-3.0.x` as a binary target for Alpine Linux compatibility. If you see engine errors, clear the volume and rebuild: `docker compose down && docker volume rm proyectoprueba_backend_node_modules && docker compose up -d --build`.

**Port conflicts:** If port `3000` is in use by a host backend process, stop it before starting the Docker stack.

## ✅ Recommended Startup Order

**Docker-based (default):**

```bash
docker compose up -d          # starts db + mailpit + backend + frontend
```

**Host-based (alternative, requires local Postgres):**

```bash
# 1. Start database and Mailpit only
docker compose up -d db mailpit

# 2. Start backend on host (uses backend/.env pointing to localhost:5432)
cd backend && npm run dev

# 3. Start frontend in a separate terminal
cd frontend && npm start
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

## 🌐 Product Translation Backfill

After running a migration that introduces the `ProductTranslation` table, seed existing products with translations using the backfill script:

```bash
cd backend
npm run backfill:translations
```

**What it does:**

1. For every active product without an `en` translation row, creates one by copying `Product.name` and `Product.description` (`source = "import"`). This is idempotent — runs already-translated products are skipped.
2. For every active product without an `es` translation row, calls LibreTranslate to translate `en → es` (`source = "machine"`). This step is skipped if `LIBRETRANSLATE_URL` is not set.

**Environment variables:**

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `LIBRETRANSLATE_URL` | No | LibreTranslate instance URL (e.g., `http://localhost:5000`). If unset, ES auto-translation is skipped. |

**Example with LibreTranslate:**

```bash
LIBRETRANSLATE_URL=http://localhost:5000 npm run backfill:translations
```

The script is safe to run multiple times (idempotent) and logs a summary of rows created vs. skipped.

## 📦 Supplier Feed Sample Import (Local Development Only)

Resets the local product catalog and loads a local JSON fixture shaped like a supplier catalog API response, so the admin panel's "product arrives without images → admin completes it" flow can be exercised without any real supplier integration:

```bash
cd backend
npm run import:supplier-feed
```

**What it does:**

1. Reads `backend/prisma/fixtures/supplier-feed.sample.json` and validates it before touching the database — a missing or malformed fixture aborts with a non-zero exit code and no database changes.
2. Cleans the local database: deletes, in foreign-key-safe order, `StripeWebhookEvent`, `CouponRedemption`, `Refund`, `ReturnRequest`, `Shipment`, `SupplierOrderItem`, `SupplierOrder`, `CustomerOrderItem`, `CustomerOrder`, `WishlistItem`, `ProductImage`, `ProductVariant`, and `Product` rows. `Category`, `Supplier`, `AdminUser`, `Customer`/`CustomerAccount`, and `Coupon` definitions are preserved, so admin/customer login and coupon codes keep working.
3. Upserts `Supplier` and `Category` rows from the fixture, then creates each `Product` in `Draft` status with `mainImageUrl: null` and zero `ProductImage` rows (even though the fixture carries an `images: []` field) — the product is intentionally incomplete until an admin adds at least one image via the existing `ImageManager` and activates it.
4. Prints a summary: `{ suppliersUpserted, categoriesUpserted, productsCreated, variantsCreated, imagesCreated: 0 }`.

**Safety guard (hard-blocked outside local development):**

The script refuses to run — with no database changes — unless both of the following hold:

- `NODE_ENV !== 'production'`
- `DATABASE_URL` resolves to a local host: `localhost`, `127.0.0.1`, or the Docker Compose service name `db`

**Important:** this is a **local development reset tool**, not an incremental sync. Every run deletes all local customer order, supplier order, shipment, return request, refund, and wishlist history along with the product catalog, then reloads the fixture from scratch. Never run this against a shared, staging, or production database.

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
   | `SMTP_STRICT` | `true` to let SMTP failures propagate as errors; default `false` |
   | `FRONTEND_URL` | Public storefront URL (CORS / redirects) |
   | `WELCOME_COUPON_PERCENT` | Discount percentage for new-customer welcome coupon (default `15`) |
   | `WELCOME_COUPON_VALIDITY_DAYS` | Days until welcome coupon expires (default `30`) |
   | `WELCOME_COUPON_MIN_ORDER` | Minimum order amount to redeem welcome coupon in EUR (default `0`) |

2. **S3 bucket** — create a bucket for the Vite `frontend/build/` artifacts (manual, one-time; `build.outDir` in `vite.config.ts` keeps the CRA-era path).

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
| `VITE_API_BASE_URL` | Baked into frontend production build |
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
VITE_API_BASE_URL="$PROD_API_URL" npm run build
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
