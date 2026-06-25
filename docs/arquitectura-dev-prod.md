# Arquitectura Dev / Prod

Este documento describe los dos entornos del proyecto: **desarrollo local con Docker** y **producción en AWS**. Incluye la estrategia de ramas, el flujo de despliegue y las diferencias clave de configuración entre entornos.

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
| Backend | `ts-node-dev` en Docker | AWS Lambda (`nodejs20.x`) |
| Frontend | CRA webpack-dev-server en Docker | S3 + CloudFront |
| Base de datos | Postgres 15 en Docker | AWS RDS PostgreSQL 16 (`eu-north-1`) |
| Email | Mailpit (local, sin SMTP real) | SMTP externo vía SSM |
| Secretos | `backend/.env.docker` (git-ignored) | SSM Parameter Store `/ecommerce/prod/*` |
| Despliegue | Manual: `docker compose up -d` | Automático: push a `master` → GitHub Actions |

---

## Entorno de desarrollo (Docker)

### Diagrama

```
localhost:3001  ←──  frontend container (CRA / webpack-dev-server)
                           │
                     /api proxy (setupProxy.js)
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
| `frontend` | `./frontend` | `3001` | CRA webpack-dev-server. Proxy `/api` → `http://ecommerce-backend:3000` via `setupProxy.js`. |

### Configuración de entorno local

**Archivo**: `backend/.env.docker` (git-ignored, nunca commitear)

Crearlo desde el ejemplo:

```bash
cp backend/.env.example backend/.env.docker
```

Variables mínimas necesarias:

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

El archivo `frontend/src/setupProxy.js` redirige todas las llamadas `/api/*` al backend:

```js
const target = process.env.BACKEND_URL || 'http://localhost:3000';
// En Docker: BACKEND_URL=http://ecommerce-backend:3000 (nombre del servicio)
// En host:   BACKEND_URL no definida → usa localhost:3000
```

Esto permite que el mismo código funcione tanto en Docker como ejecutando el frontend directamente en el host.

### Detalles técnicos importantes

**Line endings**: `.gitattributes` fuerza LF en `*.sh`, `*.yml`, `*.yaml` y `Dockerfile`. Esto evita que Windows introduzca CRLF en archivos que se ejecutan en Linux dentro del contenedor.

**Prisma binary targets**: `schema.prisma` incluye `linux-musl-openssl-3.0.x` para Alpine Linux (imagen base de los contenedores) además del target del host de desarrollo.

**trust proxy en desarrollo**: `app.set('trust proxy', 'loopback')` — el proxy de CRA corre en `127.0.0.1`, que es un loopback. Esto evita que `express-rate-limit` lance `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`.

---

## Entorno de producción (AWS)

### Diagrama

```
Browser
  │
  ├── CloudFront (CDN) ──────────────────► S3 (React SPA build)
  │       https://d1p5rkpgizqh62.cloudfront.net
  │
  └── API Gateway ──► Lambda (Express) ──► RDS PostgreSQL
          https://g54xfd8lja.execute-api.eu-north-1.amazonaws.com/prod
                                               eu-north-1 (Estocolmo)
```

### Recursos AWS

| Recurso | Identificador | Descripción |
|---|---|---|
| CloudFront | `E3V8C2LV0ASO8L` | CDN del SPA. Custom error 404/403 → `index.html` (React Router). |
| S3 | `PROD_S3_BUCKET` (GitHub secret) | Aloja el build estático de React. |
| API Gateway | `g54xfd8lja` | HTTP proxy a Lambda. Gestiona CORS preflight OPTIONS. |
| Lambda | `ecommerce-backend-prod-app` | Express envuelto con `serverless-http`. Runtime `nodejs20.x`. |
| RDS | `ecommerce-prod-db` | PostgreSQL 16, `db.t3.micro`, `eu-north-1`. `connection_limit=1` en la URL. |
| RDS endpoint | `ecommerce-prod-db.c7qigw4as957.eu-north-1.rds.amazonaws.com:5432` | |

### Secretos en SSM Parameter Store

Todos bajo `/ecommerce/prod/` como `SecureString`. Lambda los carga en tiempo de ejecución via `serverless.yml`:

| Parámetro | Descripción |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL (incluye `?connection_limit=1`) |
| `FRONTEND_URL` | URL de CloudFront (usada para CORS) |
| `ADMIN_JWT_SECRET` | Firma de tokens JWT admin |
| `ADMIN_JWT_EXPIRES_IN` | TTL del access token admin |
| `CUSTOMER_JWT_SECRET` | Firma de tokens JWT cliente |
| `CUSTOMER_JWT_EXPIRES_IN` | TTL del access token cliente |
| `COOKIE_SECRET` | Firma de cookies HttpOnly (mín. 32 chars) |
| `SMTP_HOST` | Servidor SMTP |
| `SMTP_PORT` | Puerto SMTP |
| `SMTP_SECURE` | `true` / `false` |
| `SMTP_USER` | Usuario SMTP |
| `SMTP_PASS` | Contraseña SMTP |
| `SMTP_FROM` | Dirección de envío |
| `STRIPE_SECRET_KEY` | Clave secreta Stripe (nunca exponer) |
| `STRIPE_PUBLISHABLE_KEY` | Clave pública Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret para `stripe.webhooks.constructEvent` |

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

- **CORS**: API Gateway gestiona el preflight OPTIONS con origen específico `https://d1p5rkpgizqh62.cloudfront.net`. Express maneja las respuestas con credenciales reales.
- **Cookies**: Refresh tokens usan `SameSite=None; Secure` en producción para permitir requests cross-origin entre CloudFront y API Gateway.
- **Prisma en Lambda**: El cliente Prisma compilado se incluye via `package.patterns` en `serverless.yml`. Binary target: `rhel-openssl-3.0.x` (Lambda AL2023).
- **SPA routing**: CloudFront tiene custom error responses que mapean 404/403 → `/index.html` con HTTP 200, permitiendo que React Router gestione las rutas client-side.
- **RDS conexiones**: `?connection_limit=1` en el `DATABASE_URL` evita agotar las conexiones de PostgreSQL en un entorno Lambda con múltiples instancias concurrentes.

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
  master   ──► GitHub Actions deploy.yml ──► AWS Lambda + S3 + CloudFront
```

### Protección de ramas

| Rama | Reglas |
|---|---|
| `develop` | CI obligatorio (`backend-quality` + `frontend-quality`). Admin puede hacer push directo. |
| `master` | CI obligatorio + 1 aprobación + no force-push + no borrar. Admin puede hacer push directo. |

### Pipeline de despliegue (push a `master`)

El workflow `.github/workflows/deploy.yml` ejecuta en orden:

1. `npm ci` — instala dependencias del backend
2. `npm run build` — compila TypeScript → `dist/`
3. `npx prisma generate` — genera el cliente Prisma
4. `npx prisma migrate deploy` — aplica migraciones en RDS (usa `PROD_DATABASE_URL` de GitHub secrets)
5. `npx serverless deploy --stage prod` — despliega Lambda
6. `npm ci` + `npm run build` del frontend (con `REACT_APP_API_BASE_URL` inyectado)
7. `aws s3 sync build/ s3://$PROD_S3_BUCKET --delete` — sincroniza el build a S3
8. `aws cloudfront create-invalidation` — invalida la caché de CloudFront
9. `bash scripts/smoke.sh $PROD_API_BASE_URL` — smoke tests post-deploy

### CI de calidad (PRs a `develop` o `master`)

El workflow `.github/workflows/pr-extra-quality.yml` ejecuta dos jobs en paralelo:

- **`backend-quality`**: `npm ci` → `npm run lint` → `npm test`
- **`frontend-quality`**: `npm ci --legacy-peer-deps` → `npm run lint` → `npm test`

Ambos deben pasar antes de poder hacer merge.

---

## GitHub Actions secrets necesarios

| Secret | Propósito |
|---|---|
| `AWS_ACCESS_KEY_ID` | Credenciales IAM para deploy |
| `AWS_SECRET_ACCESS_KEY` | Credenciales IAM para deploy |
| `PROD_DATABASE_URL` | Para `prisma migrate deploy` en CI |
| `PROD_S3_BUCKET` | Nombre del bucket S3 del frontend |
| `PROD_CF_DIST_ID` | `E3V8C2LV0ASO8L` — distribución CloudFront |
| `PROD_API_BASE_URL` | `https://g54xfd8lja.execute-api.eu-north-1.amazonaws.com/prod` |
| `REACT_APP_API_BASE_URL` | Igual que el anterior (baked into el build de React) |

---

## Operaciones de mantenimiento

### Pausar producción (ahorrar costes)

```bash
# Detener RDS (mantiene datos, ~$0 en cómputo)
aws rds stop-db-instance --db-instance-identifier ecommerce-prod-db --region eu-north-1
```

Lambda y API Gateway no tienen coste en reposo. CloudFront: mínimo.

**Coste estimado con todo activo**: ~$16–26/mes (dominado por RDS `db.t3.micro`).
**Coste con RDS parado**: < $1/mes (solo storage).

### Reanudar producción

```bash
# 1. Iniciar RDS (tarda ~5 min)
aws rds start-db-instance --db-instance-identifier ecommerce-prod-db --region eu-north-1

# 2. Esperar disponibilidad
aws rds wait db-instance-available --db-instance-identifier ecommerce-prod-db --region eu-north-1

# 3. El siguiente push a master redespliega todo automáticamente
```

### Redeploy manual

```bash
# Solo backend
cd backend && npx serverless deploy --stage prod

# Solo frontend
cd frontend
REACT_APP_API_BASE_URL=https://g54xfd8lja.execute-api.eu-north-1.amazonaws.com/prod npm run build
aws s3 sync build/ s3://<PROD_S3_BUCKET> --delete
aws cloudfront create-invalidation --distribution-id E3V8C2LV0ASO8L --paths "/*"
```

### Ver logs de Lambda en tiempo real

```bash
aws logs tail "/aws/lambda/ecommerce-backend-prod-app" --region eu-north-1 --follow
```

### Conectar a RDS directamente

```bash
psql "postgresql://marcel:<password>@ecommerce-prod-db.c7qigw4as957.eu-north-1.rds.amazonaws.com:5432/postgres"
```

### Seed en producción

```bash
cd backend

# Datos de productos
DATABASE_URL="postgresql://marcel:<password>@ecommerce-prod-db.c7qigw4as957.eu-north-1.rds.amazonaws.com:5432/postgres?schema=public" \
  npx prisma db seed

# Usuario admin inicial
DATABASE_URL="..." npx ts-node prisma/seedAdmin.ts
```

---

## Diferencias clave de configuración por entorno

| Aspecto | Dev (Docker) | Prod (AWS) |
|---|---|---|
| `DATABASE_URL` | `postgresql://ecommerceUser:...@db:5432/ecommerceDb` | SSM → RDS endpoint, `connection_limit=1` |
| `SMTP_HOST` | `mailpit` | SMTP externo (SSM) |
| `NODE_ENV` | `development` | `production` |
| `trust proxy` | `'loopback'` | `1` |
| Cookies | `SameSite=Lax` | `SameSite=None; Secure` |
| CORS | Todos los orígenes (dev) | Solo `https://d1p5rkpgizqh62.cloudfront.net` |
| Entrypoint backend | `entrypoint.sh` → `npm run dev` | `dist/lambda.handler` via `serverless-http` |
| Migraciones | Auto en arranque (`entrypoint.sh`) | CI pipeline (paso 4 de deploy) |
| Hot-reload | Sí (bind-mount `backend/src`) | No aplica (Lambda inmutable por invocación) |
| Stripe webhook | `stripe listen --forward-to localhost:3000/...` | URL pública de API Gateway |
