# AWS Infrastructure

Entorno de producción desplegado en `eu-north-1` (Estocolmo).

## Arquitectura

```
Browser
  │
  ├── CloudFront (CDN) ──► S3 (React SPA)
  │       ID: E3V8C2LV0ASO8L
  │       URL: https://d1p5rkpgizqh62.cloudfront.net
  │
  └── API Gateway ──► Lambda (Express/Node) ──► RDS PostgreSQL
          URL: https://g54xfd8lja.execute-api.eu-north-1.amazonaws.com/prod
```

## Recursos

| Recurso | Identificador | Notas |
|---|---|---|
| CloudFront | `E3V8C2LV0ASO8L` | SPA React, custom error → index.html |
| S3 bucket | `PROD_S3_BUCKET` (secret GitHub) | Frontend build |
| API Gateway | `g54xfd8lja` | Proxy a Lambda |
| Lambda | `ecommerce-backend-prod-app` | Express via serverless-http |
| RDS | `ecommerce-prod-db` | PostgreSQL 16, `db.t3.micro`, publicly accessible |
| RDS endpoint | `ecommerce-prod-db.c7qigw4as957.eu-north-1.rds.amazonaws.com` | Puerto 5432 |
| RDS master user | `marcel` | Password en SSM |

## SSM Parameter Store

Todos en `/ecommerce/prod/` como `SecureString`:

| Parámetro | Descripción |
|---|---|
| `DATABASE_URL` | Connection string completo de PostgreSQL |
| `FRONTEND_URL` | URL de CloudFront (para CORS) |
| `ADMIN_JWT_SECRET` | Firma de tokens JWT admin |
| `ADMIN_JWT_EXPIRES_IN` | Expiración JWT admin (ej. `15m`) |
| `CUSTOMER_JWT_SECRET` | Firma de tokens JWT cliente |
| `CUSTOMER_JWT_EXPIRES_IN` | Expiración JWT cliente (ej. `15m`) |
| `COOKIE_SECRET` | Firma de cookies HttpOnly |
| `SMTP_HOST` | Servidor SMTP de email |
| `SMTP_PORT` | Puerto SMTP |
| `SMTP_SECURE` | `true`/`false` |
| `SMTP_USER` | Usuario SMTP |
| `SMTP_PASS` | Contraseña SMTP |
| `SMTP_FROM` | Dirección de envío |
| `STRIPE_SECRET_KEY` | Clave secreta Stripe |
| `STRIPE_PUBLISHABLE_KEY` | Clave pública Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret de webhook Stripe |

Ver o editar un parámetro:
```bash
aws ssm get-parameter --name "/ecommerce/prod/DATABASE_URL" --with-decryption --region eu-north-1
aws ssm put-parameter --name "/ecommerce/prod/DATABASE_URL" --value "nuevo_valor" --type SecureString --overwrite --region eu-north-1
```

## GitHub Actions secrets (Environment: "CI/CD MiProyectoIA")

| Secret | Valor |
|---|---|
| `AWS_ACCESS_KEY_ID` | Credenciales IAM para deploy |
| `AWS_SECRET_ACCESS_KEY` | Credenciales IAM para deploy |
| `PROD_DATABASE_URL` | Connection string (solo para `prisma migrate deploy` en CI) |
| `PROD_S3_BUCKET` | Nombre del bucket S3 del frontend |
| `PROD_CF_DIST_ID` | `E3V8C2LV0ASO8L` |
| `PROD_API_BASE_URL` | `https://g54xfd8lja.execute-api.eu-north-1.amazonaws.com/prod` |
| `REACT_APP_API_BASE_URL` | Igual que el anterior (inyectado en el build de React) |
| `STRIPE_PUBLISHABLE_KEY` | Clave pública Stripe (inyectada en frontend si hace falta) |

## CI/CD

Cualquier push a `master` lanza el pipeline `.github/workflows/deploy.yml` que:

1. Instala dependencias del backend
2. Compila TypeScript
3. Genera Prisma client
4. Ejecuta migraciones (`prisma migrate deploy`)
5. Despliega Lambda via Serverless Framework (`serverless deploy --stage prod`)
6. Build del frontend React
7. Sync a S3 + invalida caché CloudFront
8. Smoke tests (`scripts/smoke.sh`)

## Comandos de operación

### Pausar (ahorrar costes)

```bash
# Detener RDS (guarda datos, ~$0 cómputo, storage mínimo)
aws rds stop-db-instance --db-instance-identifier ecommerce-prod-db --region eu-north-1

# Deshabilitar CloudFront (mantiene configuración)
# Hacer via consola AWS → CloudFront → Distribution → Edit → Disabled
# O usar el script: ver sección "Deshabilitar CloudFront" más abajo
```

Lambda y API Gateway no tienen coste en reposo — no hace falta apagarlos.

### Reanudar

```bash
# 1. Iniciar RDS (tarda ~5 min)
aws rds start-db-instance --db-instance-identifier ecommerce-prod-db --region eu-north-1

# 2. Esperar a que esté disponible
aws rds wait db-instance-available --db-instance-identifier ecommerce-prod-db --region eu-north-1

# 3. El frontend/Lambda vuelven solos con el próximo push a master
#    (el pipeline reactiva CloudFront al hacer el sync de S3)
```

### Redeploy manual del backend

```bash
cd backend
npx serverless deploy --stage prod
```

### Redeploy manual del frontend

```bash
cd frontend
REACT_APP_API_BASE_URL=https://g54xfd8lja.execute-api.eu-north-1.amazonaws.com/prod npm run build
aws s3 sync build/ s3://<BUCKET_NAME> --delete
aws cloudfront create-invalidation --distribution-id E3V8C2LV0ASO8L --paths "/*"
```

### Seed de base de datos (desde local contra producción)

```bash
cd backend

# Importar productos (40 productos de EscuelaJS API)
DATABASE_URL="postgresql://marcel:<password>@ecommerce-prod-db.c7qigw4as957.eu-north-1.rds.amazonaws.com:5432/postgres?schema=public" \
  npx prisma db seed

# Crear usuario admin inicial
DATABASE_URL="..." npx ts-node prisma/seedAdmin.ts
```

### Ver logs de Lambda en tiempo real

```bash
aws logs tail "/aws/lambda/ecommerce-backend-prod-app" --region eu-north-1 --follow
```

### Conectar directamente a RDS (con RDS arrancado)

```bash
psql "postgresql://marcel:<password>@ecommerce-prod-db.c7qigw4as957.eu-north-1.rds.amazonaws.com:5432/postgres"
```

## Costes estimados (con todo activo)

| Recurso | Coste/mes aprox. |
|---|---|
| RDS `db.t3.micro` | ~$15–25 |
| Lambda + API Gateway | < $1 (tráfico bajo) |
| S3 | < $0.10 |
| CloudFront | < $1 |
| SSM Parameters | $0 |
| **Total** | **~$16–26/mes** |

Con RDS parado: **< $1/mes** (solo storage de ~20 GB).

## Notas técnicas importantes

- **CORS**: API Gateway gestiona el preflight OPTIONS con origen específico `https://d1p5rkpgizqh62.cloudfront.net`. Configurado en `backend/serverless.yml`. Express maneja las respuestas reales.
- **Cookies**: Las cookies de refresh token usan `SameSite=None; Secure` en producción para permitir requests cross-origin (CloudFront → API Gateway).
- **Prisma en Lambda**: El cliente generado se incluye via `package.patterns` en `serverless.yml`. El `binaryTarget` es `rhel-openssl-3.0.x` (Lambda AL2023).
- **SPA routing**: CloudFront tiene custom error responses que mapean 404/403 → `/index.html` con HTTP 200, permitiendo que React Router gestione las rutas client-side.
- **RDS acceso público**: La instancia RDS tiene `Publicly Accessible = true` y un security group con el puerto 5432 abierto a `0.0.0.0/0`. Necesario para migraciones desde CI y desde local.
