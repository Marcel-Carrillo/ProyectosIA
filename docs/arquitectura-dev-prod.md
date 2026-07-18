# Arquitectura Dev / Prod

Este documento describe los dos entornos del proyecto: **desarrollo local con Docker** y **producción en AWS** (dominio `mavile.es`). Incluye la estrategia de ramas, el flujo de despliegue y las diferencias clave de configuración entre entornos. El detalle de recursos AWS (identificadores, SSM, costes, comandos de operación) vive en `docs/aws-infrastructure.md`.

---

## Visión general

```
feature/* ──► develop (CI) ──► master (CI + aprobación) ──► AWS
                │
                └── docker compose up -d (local)
```

| | Desarrollo | Producción |
|---|---|---|
| Rama | `develop` | `master` |
| Backend | `ts-node-dev` en Docker | AWS Lambda (`nodejs20.x`) — API + 2 jobs programados |
| Frontend | Vite dev server en Docker | S3 + CloudFront (`https://mavile.es`) |
| Base de datos | Postgres 15 en Docker | AWS RDS PostgreSQL 18 (`db.t4g.micro`, `eu-north-1`) |
| Email | Mailpit (local, sin SMTP real) | Amazon SES (`email-smtp.eu-north-1.amazonaws.com`) |
| Secretos | `backend/.env.docker` (git-ignored) | SSM Parameter Store `/ecommerce/prod/*` |
| Despliegue | Manual: `docker compose up -d` | Automático: push a `master` → GitHub Actions |

---

## Entorno de desarrollo (Docker)

### Diagrama

```
localhost:3001  ←──  frontend container (Vite dev server)
                           │
                     /api proxy (vite.config.ts server.proxy)
                           │
localhost:3000  ←──  backend container (ts-node-dev + hot-reload)
                           │
                      Prisma / TCP
                           │
localhost:5432  ←──  db container (Postgres 15)

localhost:8025  ←──  mailpit container (SMTP UI)
localhost:1025        (SMTP server)
```

### Servicios (docker-compose.yml)

| Servicio | Imagen / Build | Puerto host | Descripción |
|---|---|---|---|
| `db` | `postgres:15` | `5432` | Base de datos local. Volumen persistente `ecommerce-db-data`. Healthcheck con `pg_isready`. |
| `mailpit` | `axllent/mailpit:latest` | `1025` (SMTP), `8025` (UI) | Captura todos los emails en local. No envía nada al exterior. |
| `backend` | `./backend` target `dev` | `3000` | Express + ts-node-dev. Bind-mount de `backend/src` para hot-reload. Arranca solo cuando `db` está healthy. |
| `frontend` | `./frontend` | `3001` | Vite dev server. Proxy `/api` → `http://ecommerce-backend:3000` via `server.proxy` en `vite.config.ts`. |

### Configuración de entorno local

**Archivo**: `backend/.env.docker` (git-ignored, nunca commitear)

Crearlo desde el ejemplo:

```bash
cp backend/.env.example backend/.env.docker
```

`backend/.env.example` es la referencia completa y comentada de todas las variables (auth, SMTP, Stripe, CJ Dropshipping, OAuth, cupón de bienvenida). Las mínimas a ajustar para Docker:

```env
DATABASE_URL="postgresql://ecommerceUser:ecommercePassword@db:5432/ecommerceDb"
SMTP_HOST=mailpit
SMTP_PORT=1025
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
API_PUBLIC_URL=http://localhost:3000

# Stripe (modo test)
STRIPE_MODE=test
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# CJ Dropshipping (opcional en local; misma key que prod, sin separación dev/prod)
CJDROPSHIPPING_API_KEY=...
CJ_SANDBOX_ORDERS=true
```

> Las URLs de base de datos y SMTP apuntan a los nombres de servicio de Docker Compose (`db`, `mailpit`), no a `localhost`.

### Primer arranque

```bash
# 1. Crear el archivo de entorno
cp backend/.env.example backend/.env.docker
# Editar backend/.env.docker con los valores anteriores

# 2. Levantar todos los servicios
docker compose up -d

# 3. Verificar que todo está en marcha
docker compose ps
```

En el primer arranque, el contenedor `backend` ejecuta automáticamente (via `entrypoint.sh`):
1. `prisma migrate deploy` — aplica todas las migraciones
2. `prisma db seed` — carga datos de muestra (ignorado si ya existen)
3. `npm run dev` — arranca el servidor con hot-reload

### Workflow diario

```bash
# Levantar todo
docker compose up -d

# Ver logs del backend en tiempo real
docker compose logs -f backend

# Parar todo (mantiene los datos en el volumen)
docker compose down

# Parar y borrar todos los datos
docker compose down -v

# Reconstruir una imagen (tras cambiar Dockerfile o dependencias)
docker compose up -d --build backend
```

### Endpoints locales

| Servicio | URL |
|---|---|
| Frontend (React) | http://localhost:3001 |
| Backend API | http://localhost:3000 |
| Backend health | http://localhost:3000/health |
| Mailpit UI | http://localhost:8025 |
| Postgres | `localhost:5432` |

### Proxy del frontend

El bloque `server.proxy` de `frontend/vite.config.ts` redirige todas las llamadas `/api/*` al backend:

```ts
const target = process.env.BACKEND_URL || 'http://localhost:3000';
// En Docker: BACKEND_URL=http://ecommerce-backend:3000 (nombre del servicio)
// En host:   BACKEND_URL no definida → usa localhost:3000
```

Esto permite que el mismo código funcione tanto en Docker como ejecutando el frontend directamente en el host.

### Detalles técnicos importantes

**Line endings**: `.gitattributes` fuerza LF en `*.sh`, `*.yml`, `*.yaml` y `Dockerfile`. Esto evita que Windows introduzca CRLF en archivos que se ejecutan en Linux dentro del contenedor.

**Prisma binary targets**: `schema.prisma` incluye `linux-musl-openssl-3.0.x` para Alpine Linux (imagen base de los contenedores) además del target del host de desarrollo.

**trust proxy en desarrollo**: `app.set('trust proxy', 'loopback')` — el proxy del dev server de Vite corre en `127.0.0.1`, que es un loopback. Esto evita que `express-rate-limit` lance `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`.

---

## Entorno de producción (AWS)

### Diagrama

```
Browser
  │
  ├── https://mavile.es / https://www.mavile.es
  │        │
  │        ▼
  │   CloudFront (CDN) ── default ────────► S3 (React SPA build)
  │        │
  │        └── /sitemap.xml ──────────────► API Gateway (origin path /prod/api/public)
  │
  └── API Gateway ──► Lambda `app` (Express) ──► RDS PostgreSQL 18
        https://api.mavile.es (custom domain)          eu-north-1 (Estocolmo)
        https://g54xfd8lja.execute-api.eu-north-1.amazonaws.com/prod

EventBridge ──► Lambda `supplierAutoProvision` (rate 1 day)   ──► RDS + API de CJ
           └──► Lambda `cjOrderStatusSync`     (rate 1 hour)  ──► RDS + API de CJ
```

### Recursos AWS

| Recurso | Identificador | Descripción |
|---|---|---|
| Route 53 | `mavile.es` (`Z06153993DFIR8EHOD7NY`) | DNS del dominio. `mavile.es`/`www.mavile.es` → CloudFront; `api.mavile.es` → API Gateway. |
| CloudFront | `E3V8C2LV0ASO8L` | CDN del SPA. Aliases `mavile.es` + `www.mavile.es` (cert ACM en `us-east-1`). Custom error 404/403 → `index.html` (React Router). Behavior extra: `/sitemap.xml` → origen API. |
| S3 | `ecommerce-frontend-prod-803694230342-eu-north-1-an` | Aloja el build estático de React (S3 website endpoint). |
| API Gateway | `g54xfd8lja` | HTTP proxy a Lambda. Custom domain `api.mavile.es`. Gestiona CORS preflight OPTIONS. |
| Lambda | `ecommerce-backend-prod-app` | Express envuelto con `serverless-http`. Runtime `nodejs20.x`. |
| Lambda | `ecommerce-backend-prod-supplierAutoProvision` | Job diario de sync/promoción del catálogo CJ. Sin ruta HTTP; kill-switch `SUPPLIER_AUTO_PROVISION_ENABLED`. |
| Lambda | `ecommerce-backend-prod-cjOrderStatusSync` | Job horario que propaga estados de pedido CJ a `Shipment`. Sin ruta HTTP; kill-switch `FULFILLMENT_AUTOMATION_ENABLED`. |
| RDS | `ecommerce-prod-db` | PostgreSQL 18, `db.t4g.micro`, `eu-north-1`. `connection_limit=1` en la URL. |
| RDS endpoint | `ecommerce-prod-db.c7qigw4as957.eu-north-1.rds.amazonaws.com:5432` | |
| SES | `email-smtp.eu-north-1.amazonaws.com` | SMTP real de producción (`SMTP_STRICT=true`). |

### Secretos en SSM Parameter Store

Todos bajo `/ecommerce/prod/`. Lambda los carga en tiempo de deploy via `serverless.yml`. La lista completa y actualizada (incluidos los kill-switches de los jobs CJ, OAuth de Google y los parámetros opcionales con fallback) está en `docs/aws-infrastructure.md` — no se duplica aquí. Resumen por bloques:

- **Core**: `DATABASE_URL`, `FRONTEND_URL` (lista CSV de orígenes CORS), `API_PUBLIC_URL` (`https://api.mavile.es`)
- **Auth**: `ADMIN_JWT_*`, `CUSTOMER_JWT_*`, `COOKIE_SECRET`, `GOOGLE_CLIENT_ID/SECRET`
- **Email (SES)**: `SMTP_HOST/PORT/SECURE/USER/PASS/FROM`
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- **CJ Dropshipping**: `CJDROPSHIPPING_API_KEY`, `CJ_DEFAULT_CATEGORY_ID`, `SUPPLIER_AUTO_PROVISION_ENABLED`, `FULFILLMENT_AUTOMATION_ENABLED` (+ opcionales `CJ_SYNC_MAX_PAGES`, `CJ_CATALOG_PAGE_SIZE`)

Leer o actualizar un parámetro:

```bash
aws ssm get-parameter --name "/ecommerce/prod/DATABASE_URL" --with-decryption --region eu-north-1
aws ssm put-parameter --name "/ecommerce/prod/DATABASE_URL" --value "nuevo_valor" --type SecureString --overwrite --region eu-north-1
```

### trust proxy en producción

```ts
app.set('trust proxy', 1);
```

Lambda recibe requests a través de API Gateway y CloudFront, que añaden cada uno un `X-Forwarded-For`. Solo se confía en 1 hop (el más externo). Usar `true` está prohibido — permitiría spoofing de IP y saltarse rate limiting.

### Notas técnicas de producción

- **CORS**: API Gateway gestiona el preflight OPTIONS con 3 orígenes: `https://mavile.es`, `https://www.mavile.es` y `https://d1p5rkpgizqh62.cloudfront.net`. Express valida el origen real contra la lista CSV de `FRONTEND_URL`.
- **Cookies**: Refresh tokens usan `SameSite=None; Secure` en producción. El frontend llama a `https://api.mavile.es` (same-site con `mavile.es`); se mantiene `None` porque el alias de CloudFront (`d1p5rkpgizqh62.cloudfront.net`) sigue siendo un origen cross-site válido.
- **Prisma en Lambda**: El cliente Prisma compilado se incluye via `package.patterns` en `serverless.yml` (bundle con `serverless-esbuild`, Prisma como external). Binary target: `rhel-openssl-3.0.x` (Lambda AL2023).
- **SPA routing**: CloudFront tiene custom error responses que mapean 404/403 → `/index.html` con HTTP 200, permitiendo que React Router gestione las rutas client-side.
- **RDS conexiones**: `?connection_limit=1` en el `DATABASE_URL` evita agotar las conexiones de PostgreSQL en un entorno Lambda con múltiples instancias concurrentes.
- **Jobs programados**: los dos jobs CJ solo son invocables por EventBridge/IAM (sin superficie HTTP) y vienen deshabilitados por defecto via sus kill-switches en SSM.

---

## Estrategia de ramas y CI/CD

```
feature/<nombre>
    │
    │  PR → develop  (requiere CI verde)
    ▼
  develop  ──────────────────────────── Docker local (no despliega a AWS)
    │
    │  PR → master  (requiere CI verde + 1 aprobación)
    ▼
  master   ──► deploy.yml ──► AWS Lambda + S3 + CloudFront
    │
    └──► sync-develop-after-release.yml ──► fast-forward de develop a master
```

### Protección de ramas

| Rama | Reglas |
|---|---|
| `develop` | CI obligatorio (`backend-quality` + `frontend-quality`). Admin puede hacer push directo. |
| `master` | CI obligatorio + 1 aprobación + no force-push + no borrar. Admin puede hacer push directo. |

Tras un release, preferir **"Rebase and merge"** en el PR develop → master para que ambas ramas compartan el mismo tip. Si se usó merge commit, `sync-develop-after-release.yml` hace fast-forward de `develop` automáticamente (usa el secret `SYNC_DEVELOP_PAT`); si `develop` no es ancestro de `master` (hotfix), no hace nada.

### Pipeline de despliegue (push a `master`)

El workflow `.github/workflows/deploy.yml` (también lanzable a mano con `workflow_dispatch`) ejecuta en orden:

1. `npm install --legacy-peer-deps` — instala dependencias del backend
2. `npm run build` — compila TypeScript → `dist/`
3. `npx prisma generate` — genera el cliente Prisma
4. `npx prisma migrate deploy` — aplica migraciones en RDS (usa `PROD_DATABASE_URL`)
5. `npx serverless deploy --stage prod` — despliega las 3 Lambdas
6. `npm ci --legacy-peer-deps` + `npm run build` del frontend (con `VITE_API_BASE_URL` inyectado)
7. `aws s3 sync frontend/build/ s3://$PROD_S3_BUCKET --delete` — sincroniza el build a S3
8. `aws cloudfront create-invalidation` — invalida la caché de CloudFront
9. `bash scripts/smoke.sh $PROD_API_BASE_URL` — smoke tests post-deploy

### CI de calidad (PRs a `develop` o `master`)

El workflow `.github/workflows/pr-extra-quality.yml` ejecuta dos jobs en paralelo (Node 24, se saltan PRs en draft):

- **`backend-quality`**: levanta un Postgres 16 como service container, y ejecuta `npm ci` → `npm run lint` → `prisma migrate deploy` → seeds (`seedAdmin.ts`, `seedCoupons.ts`) → `npm test -- --runInBand` → `npm run build`
- **`frontend-quality`**: `npm ci --legacy-peer-deps` → ESLint → `npm test` → `tsc --noEmit`

Ambos deben pasar antes de poder hacer merge. Además hay análisis estático en `codeql-analysis.yml` y `semgrep.yml`.

---

## GitHub Actions secrets necesarios

Environment **"CI/CD MiProyectoIA"** (usado por `deploy.yml`):

| Secret | Propósito |
|---|---|
| `AWS_ACCESS_KEY_ID` | Credenciales IAM para deploy |
| `AWS_SECRET_ACCESS_KEY` | Credenciales IAM para deploy |
| `PROD_DATABASE_URL` | Para `prisma migrate deploy` en CI |
| `PROD_S3_BUCKET` | Nombre del bucket S3 del frontend |
| `PROD_CF_DIST_ID` | `E3V8C2LV0ASO8L` — distribución CloudFront |
| `PROD_API_BASE_URL` | `https://api.mavile.es` — URL base de la API para los smoke tests |
| `VITE_API_BASE_URL` | `https://api.mavile.es` (baked into el build de Vite) |

A nivel de repositorio: `SYNC_DEVELOP_PAT` (PAT admin para `sync-develop-after-release.yml`) y un duplicado de `PROD_DATABASE_URL`.

---

## Operaciones de mantenimiento

Comandos completos (pausar/reanudar RDS, redeploys manuales, logs, seeds, costes) en `docs/aws-infrastructure.md`. Referencia rápida:

```bash
# Pausar producción (ahorrar costes; los jobs programados quedan en no-op por sus kill-switches)
aws rds stop-db-instance --db-instance-identifier ecommerce-prod-db --region eu-north-1

# Reanudar
aws rds start-db-instance --db-instance-identifier ecommerce-prod-db --region eu-north-1
aws rds wait db-instance-available --db-instance-identifier ecommerce-prod-db --region eu-north-1

# Logs de la API en tiempo real
aws logs tail "/aws/lambda/ecommerce-backend-prod-app" --region eu-north-1 --follow
```

**Coste estimado con todo activo**: ~$14–23/mes (dominado por RDS `db.t4g.micro`) + renovación anual del dominio.
**Coste con RDS parado**: ~$1/mes (storage + hosted zone).

---

## Diferencias clave de configuración por entorno

| Aspecto | Dev (Docker) | Prod (AWS) |
|---|---|---|
| `DATABASE_URL` | `postgresql://ecommerceUser:...@db:5432/ecommerceDb` | SSM → RDS endpoint, `connection_limit=1` |
| `SMTP_HOST` | `mailpit` (`SMTP_STRICT=false`) | Amazon SES (`SMTP_STRICT=true`) |
| `NODE_ENV` | `development` | `production` |
| `trust proxy` | `'loopback'` | `1` |
| Cookies | `SameSite=Lax` | `SameSite=None; Secure` |
| CORS | `localhost:3001` | `mavile.es`, `www.mavile.es`, CloudFront |
| Entrypoint backend | `entrypoint.sh` → `npm run dev` | `dist/lambda.handler` via `serverless-http` |
| Migraciones | Auto en arranque (`entrypoint.sh`) | CI pipeline (paso 4 de deploy) |
| Hot-reload | Sí (bind-mount `backend/src`) | No aplica (Lambda inmutable por invocación) |
| Jobs CJ (sync catálogo / estado pedidos) | Ejecución manual desde el panel admin o scripts | EventBridge `rate(1 day)` / `rate(1 hour)`, gateados por kill-switch en SSM |
| Stripe webhook | `stripe listen --forward-to localhost:3000/...` | URL pública de API Gateway |
| Pedidos a CJ | Sandbox (`CJ_SANDBOX_ORDERS=true`) | También sandbox — forzado en `serverless.yml` hasta habilitar pedidos reales |
