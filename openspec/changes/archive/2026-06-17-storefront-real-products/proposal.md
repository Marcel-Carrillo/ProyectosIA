## Why

El storefront `/catalog` no muestra un catálogo creíble porque la base de datos no tiene productos reales, lo que impide demostrar y probar de extremo a extremo el flujo de descubrimiento (navegar, filtrar por categoría, buscar). Necesitamos poblar PostgreSQL con productos reales importados una sola vez desde EscuelaJS y servirlos al storefront a través de **nuestra propia API**, sin que el front dependa de rutas de backoffice ni llame nunca a la API externa en runtime.

## What Changes

- **Importación de catálogo (verificación):** confirmar que `npm run import:products` lee `GET https://api.escuelajs.co/api/v1/products`, transforma cada producto a nuestro modelo (`Product` + `ProductVariant` + `ProductImage` + `Category`) y lo persiste de forma idempotente. El importer y el script ya existen; esta historia los **verifica**, no los reimplementa.
- **Nueva API pública `/api/public/products`:** endpoint de listado (con `categoryId`, `search`, paginación, `sort`/`order`) y de detalle, que fuerza `status=Active` en servidor y devuelve únicamente campos seguros para el cliente.
- **Nueva API pública `/api/public/categories`:** listado de categorías para la navegación del storefront, alineado con la convención `/api/public/...`.
- **Serialización customer-safe:** las respuestas públicas **excluyen explícitamente** `supplierId`, `supplierReference`, `supplierCost`, `deletedAt` y cualquier nota interna. Esto es defensa en profundidad frente a un cambio futuro en la ruta admin.
- **Storefront consume solo nuestra API pública:** `productService` y `categoryService` del front migran de `/api/admin/products` y `/categories` a `/api/public/products` y `/api/public/categories`. Queda **prohibido** cualquier acceso a EscuelaJS desde el código de runtime del front.
- La API admin (`/api/admin/...`) y el backoffice quedan intactos.

## Capabilities

### New Capabilities
- `escuelajs-product-import`: Proceso de importación puntual que obtiene productos de la API de EscuelaJS, los transforma a nuestro modelo de dominio y los persiste en PostgreSQL de forma idempotente, filtrando datos de prueba e inválidos.
- `public-catalog-api`: Superficie REST customer-facing `/api/public/products` (listado y detalle) y `/api/public/categories` que expone solo productos/variantes `Active` y campos seguros para el cliente, nunca datos de proveedor.

### Modified Capabilities
- `frontend-skeleton`: El storefront obtiene los datos del catálogo exclusivamente desde la API pública propia (`/api/public/...`) y nunca desde la API externa de EscuelaJS en runtime.

## Impact

- **Dominio:** `Product`, `ProductVariant`, `Category`, `ProductImage` (lectura). Sin cambios de esquema; se aprovecha que `ProductVariant` ya contiene `supplierId/supplierReference/supplierCost`, que deben quedar fuera de toda respuesta pública.
- **Comportamiento:** afecta principalmente a la experiencia **customer-facing** (storefront). No toca el fulfillment interno, ni el ciclo de vida de pedidos, ni estados de pago/envío/devolución.
- **Exposición de datos de proveedor:** punto crítico — la nueva API pública debe garantizar por diseño (y por test) que no se filtran costes ni referencias de proveedor.
- **Backend (código):** nuevo router `backend/src/routes/public/`, controlador y serializador públicos; registro en `backend/src/index.ts` y `backend/src/routes/index.ts` (sustituyendo placeholders comentados). Reutiliza `ProductService`/repositorios existentes.
- **Frontend (código):** `frontend/src/services/productService.ts`, `frontend/src/services/categoryService.ts`. `CatalogPage.tsx` sin cambios de UI.
- **Datos:** ejecución manual de `npm run import:products` con BD levantada (límite por `ESCUELAJS_IMPORT_LIMIT`, default 40).
- **Dependencias externas:** EscuelaJS se usa solo en import time; cero dependencia en runtime.
