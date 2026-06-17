## Context

El storefront (`/catalog`, `CatalogPage.tsx`) ya existe y consume `productService.getAll` → `GET /api/admin/products` y `categoryService.getAll` → `GET /categories`. El backend tiene montadas esas rutas y una arquitectura por capas (Presentation, Application, Domain, Infrastructure) con `ProductService`/`ProductRepository`.

El importer desde EscuelaJS ya está implementado y verificado en código:
- `backend/src/infrastructure/external/escuelaJsTypes.ts` (tipos + URL)
- `backend/src/infrastructure/import/mapEscuelaJsProduct.ts` (mapeo + filtro de validez)
- `backend/src/infrastructure/import/escuelaJsProductImporter.ts` (fetch + upsert idempotente)
- `backend/prisma/importEscuelaJs.ts` + script `import:products` (`package.json`)

Restricción crítica del dominio: `supplierId`, `supplierReference`, `supplierCost`, notas internas y `deletedAt` no deben exponerse en APIs customer-facing. El modelo `ProductVariant` ya contiene esas columnas de proveedor (`schema.prisma:67-70`), por lo que la serialización pública debe excluirlas por diseño.

Convención del repo (comentada explícitamente en `index.ts` y `routes/index.ts`): backoffice en `/api/admin/...`, storefront en `/api/public/...`. Hoy el storefront viola esa convención al leer de `/api/admin`.

## Goals / Non-Goals

**Goals:**
- Verificar que `npm run import:products` puebla PostgreSQL con productos reales, idempotente, y que `/catalog` funciona con backend + BD levantados.
- Introducir `/api/public/products` (listado + detalle) y `/api/public/categories` con serialización customer-safe (sin datos de proveedor).
- Migrar el storefront para consumir solo `/api/public/...`, eliminando la dependencia de rutas admin y prohibiendo cualquier llamada a EscuelaJS en runtime.
- Reutilizar la lógica de aplicación/repositorio existente; no duplicar reglas de negocio.

**Non-Goals:**
- No reimplementar el importer ni cambiar su mapeo.
- No cambios de esquema Prisma ni de modelo de dominio.
- Sin carrito, checkout, autenticación, gestión de stock real ni sincronización periódica con EscuelaJS.
- Sin tocar el backoffice ni las rutas `/api/admin/...`.

## Decisions

### 1. Capa pública separada con serializador propio (no reutilizar la respuesta admin)
Se crea un router `backend/src/routes/public/`, un `publicProductController` y un serializador `publicProduct` que produce el DTO customer-safe. Reutiliza `ProductService.findAll`/`findById` (y repositorios), pero **fuerza `status=Active` en servidor** e ignora cualquier `status` del cliente, y filtra variantes a `Active`.
- **Por qué:** defensa en profundidad. Aunque hoy la ruta admin no filtra coste de proveedor al storefront (el `select` actual no lo incluye), acoplar el storefront a un contrato de backoffice es frágil: un cambio futuro en admin podría filtrar `supplierCost`. Un serializador público con allow-list explícita de campos garantiza por diseño que eso no ocurre.
- **Alternativa descartada:** que el storefront siga leyendo `/api/admin/products`. Rechazada por la restricción de dominio y la convención del repo.
- **Alternativa descartada:** serializador con block-list (borrar campos sensibles). Rechazada frente a allow-list (más segura ante nuevos campos).

### 2. `/api/public/categories` propio en lugar de reutilizar `/categories`
Se añade `/api/public/categories` por consistencia del contrato público. `Category` no tiene datos de proveedor, así que la implementación puede reutilizar el controlador/servicio de categorías existente.
- **Por qué:** alinea storefront con la convención `/api/public/...` y deja `/categories` para uso administrativo/legacy sin ambigüedad.
- **Alternativa aceptable a corto plazo:** mantener `/categories` como pública; descartada por coherencia.

### 3. Identificador de detalle por `id` numérico
El detalle público se sirve por `id` numérico (`GET /api/public/products/:id`).
- **Por qué (resuelto durante implementación):** el storefront ya enruta el detalle por id (`/catalog/:id`, `getById(Number(id))`) y `ProductRepository.findById` carga eager las variantes y las imágenes. En cambio, `findBySlug` hace un `findFirst` plano sin relaciones, por lo que servir por slug requeriría una consulta nueva y cambiar el routing/UI del front (fuera de alcance). Usar `id` es la opción mínima y consistente con el front actual.
- **Alternativa descartada:** por `slug` (más SEO-friendly). Requeriría enriquecer `findBySlug` y modificar `ProductCard`/`ProductPage`; se pospone a una historia de SEO.

### 4. Paginación acotada
`pageSize` por defecto (p. ej. 20, como el storefront) y máximo (100). El controlador público limita el valor recibido.
- **Por qué:** evitar volcados completos de catálogo desde una API pública.

### 5. Verificación de `/catalog` extremo a extremo
Se valida levantando backend + BD, ejecutando `import:products` y comprobando en el navegador que `/catalog` renderiza productos reales y que Network no muestra peticiones a `api.escuelajs.co` ni a `/api/admin`.

## Risks / Trade-offs

- **Fuga de datos de proveedor en respuestas públicas** → Mitigación: serializador con allow-list explícita + test que falla si aparece `supplierId/supplierReference/supplierCost/deletedAt`.
- **Duplicación de lógica entre admin y public** → Mitigación: el router público reutiliza `ProductService`/repositorios; solo difiere el serializador y el forzado de `status=Active`.
- **Datos de baja calidad desde EscuelaJS (imágenes rotas, precios atípicos)** → Mitigación: el importer ya filtra `test_/test-`, productos sin imágenes y `price<=0`; el front degrada con placeholder de imagen.
- **Disponibilidad/latencia de la API externa en import time** → Mitigación: el fetch falla con error claro y exit code distinto de cero; la importación es manual y reintentar es seguro (idempotente).
- **Deriva del contrato si en el futuro se añaden campos al producto** → Mitigación: la allow-list obliga a una decisión explícita para exponer cualquier campo nuevo.
- **CORS:** el origin del storefront debe estar en `FRONTEND_URL`; ya contemplado en `index.ts`.

## Migration Plan

1. Añadir router/controlador/serializador público y registrarlos en `index.ts` y `routes/index.ts` (sin tocar admin).
2. Ejecutar `npm run import:products` con BD levantada para poblar datos reales.
3. Migrar `productService`/`categoryService` del front a las rutas públicas.
4. Verificar `/catalog` en navegador (datos reales, sin llamadas externas ni admin).
- **Rollback:** las rutas públicas son aditivas; revertir los cambios del front restaura el comportamiento anterior sin afectar al backoffice.

## Open Questions

- ¿`/api/public/categories` debe devolver solo categorías con productos activos, o todas las categorías activas? (Por defecto: todas las categorías activas; refinar si el storefront necesita ocultar categorías vacías.)
- (Resuelto) El detalle público se expone por `id` numérico, para alinearse con el routing actual del storefront y la carga eager de `findById`. Una variante por `slug` queda para una futura historia de SEO.
- **Dato del entorno EscuelaJS:** la API demo re-siembra ~20 productos bajo una categoría `test_<hash>` que el importer (correctamente) descarta; quedan ~35 productos con categorías reales (Electronics, Furniture, Shoes, Miscellaneous). Con un `ESCUELAJS_IMPORT_LIMIT` muy bajo se pueden importar 0 productos si todos los primeros caen en la categoría `test_`. Usar el límite por defecto (40) o superior para poblar el catálogo.
