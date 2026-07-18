# AWS Infrastructure

Entorno de producción desplegado en `eu-north-1` (Estocolmo). Dominio propio: **mavile.es**.

## Arquitectura

```
Browser
  │
  ├── https://mavile.es / https://www.mavile.es
  │        │
  │        ▼
  │   CloudFront (E3V8C2LV0ASO8L, cert ACM en us-east-1)
  │        ├── default ──────────► S3 website (React SPA build)
  │        └── /sitemap.xml ─────► API Gateway (origin path /prod/api/public)
  │
  └── API directa ──► API Gateway ──► Lambda (Express) ──► RDS PostgreSQL
        https://api.mavile.es  (custom domain → g54xfd8lja, stage prod)
        https://g54xfd8lja.execute-api.eu-north-1.amazonaws.com/prod

EventBridge (schedule) ──► Lambda supplierAutoProvision  (rate 1 day)
                      └──► Lambda cjOrderStatusSync      (rate 1 hour)
```

## Dominio y DNS

| Recurso | Valor |
|---|---|
| Dominio | `mavile.es` (Route 53 hosted zone `Z06153993DFIR8EHOD7NY`) |
| Frontend | `mavile.es` y `www.mavile.es` → aliases de CloudFront `E3V8C2LV0ASO8L` |
| API | `api.mavile.es` → custom domain de API Gateway, base path mapping a `g54xfd8lja` stage `prod` |
| Certificado frontend | ACM en `us-east-1` (requisito de CloudFront): `5be3ab8a-93a8-44dd-a81c-24c58e54a6db` |

> La URL original `https://d1p5rkpgizqh62.cloudfront.net` sigue funcionando y sigue en la lista de CORS. Desde el 2026-07-18 el frontend usa `https://api.mavile.es` como base de la API (`VITE_API_BASE_URL`), igual que `API_PUBLIC_URL`; la URL raw `execute-api` sigue respondiendo (es el mismo API Gateway) pero ya no la referencia el bundle.

## Recursos

| Recurso | Identificador | Notas |
|---|---|---|
| CloudFront | `E3V8C2LV0ASO8L` | Aliases `mavile.es` + `www.mavile.es`. Dos orígenes: S3 website (default) y API Gateway con origin path `/prod/api/public` (behavior `/sitemap.xml`). Custom error 403/404 → `/index.html` (HTTP 200, TTL 10s). |
| S3 bucket | `ecommerce-frontend-prod-803694230342-eu-north-1-an` | Frontend build, servido como S3 website endpoint. También referenciado como secret `PROD_S3_BUCKET` en GitHub. |
| API Gateway | `g54xfd8lja` | REST API, proxy a Lambda. Custom domain `api.mavile.es`. CORS para 3 orígenes (ver abajo). |
| Lambda | `ecommerce-backend-prod-app` | Express via serverless-http, runtime `nodejs20.x` |
| Lambda | `ecommerce-backend-prod-supplierAutoProvision` | Job programado (EventBridge `rate(1 day)`), timeout 900s, sin API Gateway ni ruta HTTP — solo invocable por IAM/EventBridge. Automatiza el flujo manual de conexión/verificación/sync/promoción de CJ Dropshipping (ver `docs/development_guide.md`) |
| Lambda | `ecommerce-backend-prod-cjOrderStatusSync` | Job programado (EventBridge `rate(1 hour)`), timeout 900s, sin ruta HTTP. Consulta el estado de pedidos push-eados a CJ y lo propaga a `Shipment` (spec fulfillment-automation). No-op salvo que `FULFILLMENT_AUTOMATION_ENABLED='true'` |
| RDS | `ecommerce-prod-db` | PostgreSQL 18.3, `db.t4g.micro`, publicly accessible |
| RDS endpoint | `ecommerce-prod-db.c7qigw4as957.eu-north-1.rds.amazonaws.com` | Puerto 5432 |
| RDS master user | `marcel` | Password en SSM |
| SES | `email-smtp.eu-north-1.amazonaws.com` | SMTP de producción (puerto 587, STARTTLS). Usuario IAM `ecommerce-ses-smtp` |

### CORS

Orígenes permitidos (definidos en `backend/serverless.yml` y en `FRONTEND_URL` de SSM como lista separada por comas):

- `https://mavile.es`
- `https://www.mavile.es`
- `https://d1p5rkpgizqh62.cloudfront.net`

## SSM Parameter Store

Todos en `/ecommerce/prod/`. Los que existen actualmente:

| Parámetro | Descripción |
|---|---|
| `DATABASE_URL` | Connection string completo de PostgreSQL |
| `FRONTEND_URL` | Lista CSV de orígenes CORS: `https://mavile.es,https://www.mavile.es,https://d1p5rkpgizqh62.cloudfront.net` |
| `API_PUBLIC_URL` | `https://api.mavile.es` — URL pública base de la API (URLs generadas por el backend) |
| `ADMIN_JWT_SECRET` | Firma de tokens JWT admin |
| `ADMIN_JWT_EXPIRES_IN` | Expiración JWT admin (ej. `15m`) |
| `CUSTOMER_JWT_SECRET` | Firma de tokens JWT cliente |
| `CUSTOMER_JWT_EXPIRES_IN` | Expiración JWT cliente (ej. `15m`) |
| `COOKIE_SECRET` | Firma de cookies HttpOnly |
| `SMTP_HOST` | `email-smtp.eu-north-1.amazonaws.com` (Amazon SES) |
| `SMTP_PORT` | Puerto SMTP (587) |
| `SMTP_SECURE` | `true`/`false` |
| `SMTP_USER` | AccessKeyId del usuario IAM `ecommerce-ses-smtp` |
| `SMTP_PASS` | Password SMTP derivado de la secret key IAM |
| `SMTP_FROM` | Dirección de envío (`mcarhue@mavile.es`) |
| `STRIPE_SECRET_KEY` | Clave secreta Stripe |
| `STRIPE_PUBLISHABLE_KEY` | Clave pública Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret de webhook Stripe |
| `GOOGLE_CLIENT_ID` | OAuth Google (login social); fallback `''` en `serverless.yml` |
| `GOOGLE_CLIENT_SECRET` | OAuth Google; fallback `''` |
| `CJDROPSHIPPING_API_KEY` | Clave real de la API de CJ Dropshipping — misma cuenta/key que en dev (no hay separación dev/prod en CJ); fallback `''` para no romper el deploy si faltara |
| `CJ_DEFAULT_CATEGORY_ID` | `Category.id` de respaldo usado en la promoción cuando falla la resolución de taxonomía CJ. Debe apuntar a una categoría existente (ej. "Uncategorized"); fallback `''` — si falta o es inválida, el sync persiste pero la promoción se omite (logueado) |
| `SUPPLIER_AUTO_PROVISION_ENABLED` | Kill-switch del job `supplierAutoProvision`. Debe ser exactamente `'true'` para ejecutar; fallback `'false'` |
| `FULFILLMENT_AUTOMATION_ENABLED` | Kill-switch de la cadena pedido-pagado → supplier-order → push a CJ, y del job `cjOrderStatusSync`. Fallback `'false'`. Los pushes a CJ siguen forzados a sandbox (`CJ_SANDBOX_ORDERS='true'` en `serverless.yml`) |

Parámetros **opcionales** referenciados en `serverless.yml` que hoy **no existen** en SSM (aplica el fallback):

| Parámetro | Fallback | Descripción |
|---|---|---|
| `CJ_SYNC_MAX_PAGES` | `'3'` | Páginas por *ventana* de sync — cada corrida avanza desde el cursor persistido (`SupplierIntegration.catalogSyncCursorPage`), no reinicia en página 1. **Obligatorio acotarlo en producción, no solo cortesía de rate-limit**: `syncCatalog` hace una llamada `fetchVariants` por producto en cada página, así que una ventana sin acotar nunca termina dentro del timeout de 900s del Lambda — ver `reports/2026-07-09-production-incident-lock-transaction-revert.md` del change `cj-catalog-auto-provisioning` |
| `CJ_CATALOG_PAGE_SIZE` | `'100'` | Tamaño de página por sync. Con `CJ_SYNC_MAX_PAGES=3` → ~300 productos/corrida, ~442s estimados (estudio de throughput en `openspec/changes/cj-catalog-cursor-and-media/design.md` D2). Compartido con el sync manual del panel admin |

Otras variables de entorno de la Lambda fijadas **directamente en `serverless.yml`** (no SSM): `NODE_ENV=production`, `SMTP_STRICT='true'`, `WELCOME_COUPON_PERCENT='15'`, `WELCOME_COUPON_MIN_ORDER='0'`, `CJ_API_BASE_URL` (URL de la API v2 de CJ), `CJ_SANDBOX_ORDERS='true'`, `CJ_DEFAULT_MARKUP_MULTIPLIER='1.6'`, `CJ_DEFAULT_SHIPPING_ESTIMATE='8'`.

Ver o editar un parámetro:
```bash
aws ssm get-parameter --name "/ecommerce/prod/DATABASE_URL" --with-decryption --region eu-north-1
aws ssm put-parameter --name "/ecommerce/prod/DATABASE_URL" --value "nuevo_valor" --type SecureString --overwrite --region eu-north-1
```

## GitHub Actions secrets

Environment **"CI/CD MiProyectoIA"** (usado por `deploy.yml`):

| Secret | Valor |
|---|---|
| `AWS_ACCESS_KEY_ID` | Credenciales IAM para deploy |
| `AWS_SECRET_ACCESS_KEY` | Credenciales IAM para deploy |
| `PROD_DATABASE_URL` | Connection string (solo para `prisma migrate deploy` en CI) |
| `PROD_S3_BUCKET` | `ecommerce-frontend-prod-803694230342-eu-north-1-an` |
| `PROD_CF_DIST_ID` | `E3V8C2LV0ASO8L` |
| `PROD_API_BASE_URL` | `https://api.mavile.es` — URL base de la API para los smoke tests |
| `VITE_API_BASE_URL` | `https://api.mavile.es` (inyectado en el build de Vite) |

Secrets a nivel de repositorio:

| Secret | Propósito |
|---|---|
| `PROD_DATABASE_URL` | Duplicado del anterior a nivel repo |
| `SYNC_DEVELOP_PAT` | PAT admin usado por `sync-develop-after-release.yml` para fast-forward de `develop` tras un release |

## CI/CD

Workflows en `.github/workflows/`:

| Workflow | Disparo | Qué hace |
|---|---|---|
| `deploy.yml` | Push a `master` (+ manual `workflow_dispatch`) | Build + migraciones + deploy completo (ver abajo) |
| `pr-extra-quality.yml` | PRs a `develop`/`master` | Jobs `backend-quality` y `frontend-quality` (lint, tests, build) |
| `sync-develop-after-release.yml` | Push a `master` | Fast-forward de `develop` a `master` tras un release (safety net cuando el release usó merge commit) |
| `codeql-analysis.yml` | — | Análisis estático CodeQL |
| `semgrep.yml` | — | Análisis estático Semgrep |

Pipeline de `deploy.yml`:

1. Instala dependencias del backend (`npm install --legacy-peer-deps`)
2. Compila TypeScript (`npm run build`)
3. Genera Prisma client
4. Ejecuta migraciones (`prisma migrate deploy` con `PROD_DATABASE_URL`)
5. Despliega las 3 Lambdas via Serverless Framework (`serverless deploy --stage prod`)
6. Build del frontend con Vite (`VITE_API_BASE_URL` inyectado)
7. Sync de `frontend/build/` a S3 + invalidación de caché CloudFront
8. Smoke tests (`scripts/smoke.sh $PROD_API_BASE_URL`)

## Comandos de operación

### Pausar (ahorrar costes)

```bash
# Detener RDS (guarda datos, ~$0 cómputo, storage mínimo)
aws rds stop-db-instance --db-instance-identifier ecommerce-prod-db --region eu-north-1

# Deshabilitar CloudFront (mantiene configuración)
# Hacer via consola AWS → CloudFront → Distribution → Edit → Disabled
```

Lambda y API Gateway no tienen coste en reposo — no hace falta apagarlos. Ojo: los jobs programados (`supplierAutoProvision`, `cjOrderStatusSync`) seguirán disparándose contra una RDS parada; sus kill-switches en SSM los dejan en no-op.

### Reanudar

```bash
# 1. Iniciar RDS (tarda ~5 min)
aws rds start-db-instance --db-instance-identifier ecommerce-prod-db --region eu-north-1

# 2. Esperar a que esté disponible
aws rds wait db-instance-available --db-instance-identifier ecommerce-prod-db --region eu-north-1

# 3. El frontend/Lambda vuelven solos con el próximo push a master
```

### Redeploy manual del backend

```bash
cd backend
npx serverless deploy --stage prod
```

### Redeploy manual del frontend

```bash
cd frontend
VITE_API_BASE_URL=https://api.mavile.es npm run build
aws s3 sync build/ s3://ecommerce-frontend-prod-803694230342-eu-north-1-an --delete
aws cloudfront create-invalidation --distribution-id E3V8C2LV0ASO8L --paths "/*"
```

### Seed de base de datos (desde local contra producción)

```bash
cd backend

# Datos de productos
DATABASE_URL="postgresql://marcel:<password>@ecommerce-prod-db.c7qigw4as957.eu-north-1.rds.amazonaws.com:5432/postgres?schema=public" \
  npx prisma db seed

# Crear usuario admin inicial y cupones
DATABASE_URL="..." npx ts-node prisma/seedAdmin.ts
DATABASE_URL="..." npx ts-node prisma/seedCoupons.ts
```

### Ver logs de Lambda en tiempo real

```bash
aws logs tail "/aws/lambda/ecommerce-backend-prod-app" --region eu-north-1 --follow
aws logs tail "/aws/lambda/ecommerce-backend-prod-supplierAutoProvision" --region eu-north-1 --follow
aws logs tail "/aws/lambda/ecommerce-backend-prod-cjOrderStatusSync" --region eu-north-1 --follow
```

### Conectar directamente a RDS (con RDS arrancado)

```bash
psql "postgresql://marcel:<password>@ecommerce-prod-db.c7qigw4as957.eu-north-1.rds.amazonaws.com:5432/postgres"
```

## Costes estimados (con todo activo)

| Recurso | Coste/mes aprox. |
|---|---|
| RDS `db.t4g.micro` | ~$12–20 |
| Lambda + API Gateway | < $1 (tráfico bajo) |
| S3 | < $0.10 |
| CloudFront | < $1 |
| Route 53 hosted zone | $0.50 |
| SES | $0 (dentro del free tier a este volumen) |
| SSM Parameters | $0 |
| **Total** | **~$14–23/mes** (+ renovación anual del dominio `mavile.es`) |

Con RDS parado: **~$1/mes** (storage de RDS + hosted zone).

## Notas técnicas importantes

- **CORS**: API Gateway gestiona el preflight OPTIONS con los 3 orígenes listados arriba. Configurado en `backend/serverless.yml`. Express valida el origen real contra la lista CSV de `FRONTEND_URL`.
- **Cookies**: Las cookies de refresh token usan `SameSite=None; Secure` en producción. Desde que el frontend llama a `api.mavile.es`, las requests son same-site (`mavile.es` ↔ `api.mavile.es`), pero se mantiene `None` para no romper el acceso desde el alias de CloudFront (`d1p5rkpgizqh62.cloudfront.net`), que sí es cross-site.
- **Prisma en Lambda**: El cliente generado se incluye via `package.patterns` en `serverless.yml`. El `binaryTarget` es `rhel-openssl-3.0.x` (Lambda AL2023). El bundle se genera con `serverless-esbuild` (Prisma como external).
- **SPA routing**: CloudFront tiene custom error responses que mapean 404/403 → `/index.html` con HTTP 200, permitiendo que React Router gestione las rutas client-side.
- **Sitemap**: `https://mavile.es/sitemap.xml` no sale de S3 — un cache behavior de CloudFront lo enruta al origen API (`/prod/api/public/sitemap.xml`), generado dinámicamente por el backend usando `API_PUBLIC_URL`/`FRONTEND_URL`.
- **RDS acceso público**: La instancia RDS tiene `Publicly Accessible = true` y un security group con el puerto 5432 abierto a `0.0.0.0/0`. Necesario para migraciones desde CI y desde local.
- **Monitorización**: alarma manual de CloudWatch `ecommerce-api-5xx-high` (AWS/ApiGateway `5XXError` ≥ 5 en 5 min) — documentada en el bloque comentado al final de `serverless.yml`; no la gestiona el deploy.
